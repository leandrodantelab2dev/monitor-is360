'use strict'

const AdmZip = require('adm-zip')
const { XMLParser } = require('fast-xml-parser')
const config = require('../config/best-practices.json')
const { rules } = require('./rules')

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true })

function parseProperties(text) {
  const props = {}
  text.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) return
    const idx = trimmed.indexOf('=')
    if (idx === -1) return
    props[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  })
  return props
}

// Descompacta o zip do iFlow e extrai .iflw (BPMN2), scripts .groovy e parameters.prop
function unpackIflowZip(buffer) {
  const zip = new AdmZip(buffer)
  const entries = zip.getEntries()

  const iflwEntry = entries.find(e => e.entryName.toLowerCase().endsWith('.iflw'))
  if (!iflwEntry) throw new Error('Arquivo .iflw nao encontrado no pacote do iFlow')
  const xml = zip.readAsText(iflwEntry)

  const scripts = entries
    .filter(e => e.entryName.toLowerCase().endsWith('.groovy'))
    .map(e => ({ name: e.entryName.split('/').pop(), content: zip.readAsText(e) }))

  const propsEntry = entries.find(e => e.entryName.toLowerCase().endsWith('parameters.prop'))
  const parameters = propsEntry ? parseProperties(zip.readAsText(propsEntry)) : {}

  return { xml, doc: xmlParser.parse(xml), scripts, parameters }
}

function band(score) {
  const { faixas } = config.score
  if (score >= faixas.verde.min) return 'verde'
  if (score >= faixas.amarelo.min) return 'amarelo'
  return 'vermelho'
}

// Roda todas as regras aplicaveis contra o contexto do iFlow e calcula o score.
// ctx: { meta: {description, version}, pkg: {description, tags} | null, zipBuffer }
function analyze(ctx) {
  const { doc, scripts, parameters } = unpackIflowZip(ctx.zipBuffer)
  const ruleCtx = { meta: ctx.meta, pkg: ctx.pkg, doc, scripts, parameters, config }

  const results = []
  let earned = 0
  let applicable = 0

  for (const rule of config.regras) {
    const outcome = rules[rule.id] ? rules[rule.id](ruleCtx) : null
    if (!outcome) continue // regra nao aplicavel a este iFlow
    applicable += rule.peso
    if (outcome.passed) earned += rule.peso
    results.push({
      ruleId: rule.id,
      categoria: rule.categoria,
      severidade: rule.severidade,
      passed: outcome.passed,
      detalhe: outcome.passed ? outcome.detalhe : `${outcome.detalhe} — ${rule.dica}`
    })
  }

  const score = applicable ? Math.round((earned / applicable) * 10000) / 100 : 0
  return { score, band: band(score), results }
}

module.exports = { analyze, unpackIflowZip, parseProperties, band }
