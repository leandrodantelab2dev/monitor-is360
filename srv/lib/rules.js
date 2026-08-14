'use strict'

const DEFAULT_STEP_NAME = /^(Content Modifier|Request Reply|Groovy Script|Router|Splitter|Gather|Message Mapping|Filter|Script)( \d+)?$/
const DEFAULT_PARTICIPANT_NAME = /^(Participant|Sender|Receiver)( \d+)?$/
const SEMVER = /^\d+\.\d+\.\d+$/
const PACKAGE_NAME_PATTERN = /.+\s+x\s+.+/i
const EXTERNALIZED = /^\{\{.+\}\}$/
const GENERIC_SCRIPT_NAME = /error|util|common|generic|handler|helper/i
const DEFAULT_SCRIPT_NAME = /^script\d+/i
const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/

// ponytail: caminha a arvore inteira do XML parseado coletando toda ocorrencia de uma tag,
// sem modelar o schema BPMN2 completo (namespaces ja foram removidos pelo parser).
function walk(node, tag, visit) {
  if (Array.isArray(node)) { node.forEach(n => walk(n, tag, visit)); return }
  if (!node || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node)) {
    if (key === tag) (Array.isArray(value) ? value : [value]).forEach(visit)
    else if (typeof value === 'object') walk(value, tag, visit)
  }
}

function collectNames(doc, tags) {
  const names = []
  for (const tag of tags) walk(doc, tag, n => { if (n && n['@_name']) names.push(n['@_name']) })
  return names
}

function extProps(node) {
  const props = {}
  walk(node, 'property', p => { if (p && p.key != null) props[p.key] = p.value })
  return props
}

function hasExternalCall(doc) {
  let found = false
  walk(doc, 'messageFlow', mf => { if (extProps(mf).Direction === 'Receiver') found = true })
  walk(doc, 'callActivity', n => { if (extProps(n).activityType === 'ExternalCall') found = true })
  walk(doc, 'serviceTask', n => { if (extProps(n).activityType === 'ExternalCall') found = true })
  return found
}

function hasErrorSubprocess(doc) {
  let found = false
  walk(doc, 'subProcess', n => { if (n && n['@_triggeredByEvent'] === 'true') found = true })
  return found
}

const rules = {
  'PKG-01': ctx => {
    if (!ctx.pkg) return null
    const text = (ctx.pkg.description || '').trim()
    return { passed: text.length >= 20, detalhe: text ? `Descricao com ${text.length} caracteres` : 'Pacote sem descricao' }
  },

  'PKG-02': ctx => {
    if (!ctx.pkg) return null
    const name = ctx.pkg.name || ''
    return { passed: PACKAGE_NAME_PATTERN.test(name), detalhe: `Nome do pacote: "${name}"` }
  },

  'PKG-03': ctx => {
    if (!ctx.pkg) return null
    const tags = ctx.pkg.tags || ''
    const hasCore = /Products:/.test(tags) && /Keywords:/.test(tags)
    const hasOne = /Countries:|Industries:|LineOfBusiness:/.test(tags)
    return {
      passed: hasCore && hasOne,
      detalhe: hasCore && hasOne ? 'Tags preenchidas' : 'Faltam tags obrigatorias (Products, Keywords e ao menos uma de Countries/Industries/LineOfBusiness)'
    }
  },

  'IFL-01': ctx => {
    const text = (ctx.meta.description || '').trim()
    return { passed: text.length > 0, detalhe: text ? 'Descricao preenchida' : 'iFlow sem descricao' }
  },

  'IFL-02': ctx => {
    const version = ctx.meta.version || ''
    return { passed: SEMVER.test(version), detalhe: `Versao: "${version}"` }
  },

  'BPM-01': ctx => {
    if (!hasExternalCall(ctx.doc)) return null
    const ok = hasErrorSubprocess(ctx.doc)
    return { passed: ok, detalhe: ok ? 'Exception Subprocess presente' : 'Ha chamada a sistema externo sem Exception Subprocess' }
  },

  'BPM-02': ctx => {
    const names = collectNames(ctx.doc, ['callActivity', 'serviceTask', 'task', 'scriptTask', 'exclusiveGateway', 'parallelGateway'])
    const defaults = names.filter(n => DEFAULT_STEP_NAME.test(n))
    return { passed: defaults.length === 0, detalhe: defaults.length ? `Steps com nome default: ${[...new Set(defaults)].join(', ')}` : 'Nenhum step com nome default' }
  },

  'BPM-03': ctx => {
    let ok = false
    walk(ctx.doc, 'callActivity', n => { if (isExternalizedLogModifier(n)) ok = true })
    walk(ctx.doc, 'serviceTask', n => { if (isExternalizedLogModifier(n)) ok = true })
    return { passed: ok, detalhe: ok ? 'Content Modifier com logs externalizados encontrado' : 'Nenhum Content Modifier com logs externalizados' }

    function isExternalizedLogModifier(n) {
      const props = extProps(n)
      return ['logBody', 'logHeaders', 'logProperties'].some(k => props[k] && EXTERNALIZED.test(props[k]))
    }
  },

  'BPM-04': ctx => {
    const ok = ctx.scripts.some(s => s.content.includes('messageLogFactory.getMessageLog'))
    return { passed: ok, detalhe: ok ? 'Script de monitor message logger encontrado' : 'Nenhum script referencia messageLogFactory.getMessageLog' }
  },

  'BPM-05': ctx => {
    const names = collectNames(ctx.doc, ['participant'])
    const defaults = names.filter(n => DEFAULT_PARTICIPANT_NAME.test(n))
    return { passed: defaults.length === 0, detalhe: defaults.length ? `Participantes com nome default: ${[...new Set(defaults)].join(', ')}` : 'Participantes renomeados' }
  },

  'BPM-06': ctx => {
    const suspicious = []
    walk(ctx.doc, 'property', p => {
      if (!p || p.key == null || p.value == null) return
      if (!/url|address|host|password|username|^user$/i.test(p.key)) return
      const value = String(p.value)
      if (value && !EXTERNALIZED.test(value)) suspicious.push(`${p.key}="${value}"`)
    })
    return { passed: suspicious.length === 0, detalhe: suspicious.length ? `Valores nao externalizados: ${suspicious.join(', ')}` : 'Nenhum valor hardcoded encontrado' }
  },

  'BPM-07': ctx => {
    const deprecated = ctx.config.adaptersDescontinuados || []
    if (!deprecated.length) return null
    const found = []
    walk(ctx.doc, 'messageFlow', mf => {
      const type = extProps(mf).ComponentType
      if (type && deprecated.includes(type)) found.push(type)
    })
    return { passed: found.length === 0, detalhe: found.length ? `Adapters descontinuados em uso: ${[...new Set(found)].join(', ')}` : 'Nenhum adapter descontinuado' }
  },

  'SCR-01': ctx => {
    if (!ctx.scripts.length) return null
    const bad = ctx.scripts.filter(s => {
      const base = s.name.replace(/\.groovy$/i, '')
      return DEFAULT_SCRIPT_NAME.test(base) || !CAMEL_CASE.test(base)
    })
    return { passed: bad.length === 0, detalhe: bad.length ? `Scripts fora do padrao: ${bad.map(s => s.name).join(', ')}` : 'Scripts nomeados corretamente' }
  },

  'SCR-02': ctx => {
    if (!ctx.scripts.length) return null
    const bad = ctx.scripts.filter(s => /import\s+groovy\.(json|xml)\.\*/.test(s.content))
    return { passed: bad.length === 0, detalhe: bad.length ? `Import absoluto em: ${bad.map(s => s.name).join(', ')}` : 'Nenhum import absoluto' }
  },

  // ponytail: nao ha como inspecionar Script Collections externas a partir do zip de um unico iFlow;
  // heuristica: scripts com nome "generico" embutidos localmente deveriam estar segregados.
  'SCR-03': ctx => {
    if (!ctx.scripts.length) return null
    const generic = ctx.scripts.filter(s => GENERIC_SCRIPT_NAME.test(s.name))
    return { passed: generic.length === 0, detalhe: generic.length ? `Scripts genericos embutidos (deveriam estar em Script Collection): ${generic.map(s => s.name).join(', ')}` : 'Nenhum script generico embutido' }
  }
}

module.exports = { rules, walk, collectNames, extProps, hasExternalCall, hasErrorSubprocess }
