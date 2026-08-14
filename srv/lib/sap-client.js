'use strict'

const fs = require('fs')
const path = require('path')

let tokenCache = null // { accessToken, expiresAt }

function loadConfig() {
  const envPath = path.join(__dirname, '..', '..', 'default-env.json')
  let file = {}
  if (fs.existsSync(envPath)) {
    file = JSON.parse(fs.readFileSync(envPath, 'utf8')).CPI || {}
  }
  const cfg = {
    clientId: process.env.CPI_CLIENT_ID || file.clientId,
    clientSecret: process.env.CPI_CLIENT_SECRET || file.clientSecret,
    tokenUrl: process.env.CPI_TOKEN_URL || file.tokenUrl,
    baseUrl: process.env.CPI_BASE_URL || file.baseUrl
  }
  const missing = Object.entries(cfg).filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) {
    throw new Error(`Configuracao do CPI incompleta (faltando: ${missing.join(', ')}). Preencha default-env.json (bloco "CPI") ou as variaveis de ambiente CPI_CLIENT_ID/CPI_CLIENT_SECRET/CPI_TOKEN_URL/CPI_BASE_URL.`)
  }
  return cfg
}

async function getToken(cfg) {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5000) return tokenCache.accessToken
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  const res = await fetch(`${cfg.tokenUrl}?grant_type=client_credentials`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` }
  })
  if (!res.ok) throw new Error(`Falha ao obter token OAuth2 do CPI (${res.status} ${res.statusText})`)
  const body = await res.json()
  tokenCache = { accessToken: body.access_token, expiresAt: Date.now() + (body.expires_in || 3600) * 1000 }
  return tokenCache.accessToken
}

async function request(cfg, pathAndQuery, { binary = false } = {}) {
  const token = await getToken(cfg)
  const res = await fetch(`${cfg.baseUrl}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: binary ? '*/*' : 'application/json' }
  })
  if (res.status === 401) {
    tokenCache = null // forca renovar o token na proxima chamada
    throw new Error(`Nao autorizado pelo Management API do CPI: ${pathAndQuery}`)
  }
  if (!res.ok) throw new Error(`Erro ${res.status} no Management API do CPI: ${pathAndQuery}`)
  return binary ? Buffer.from(await res.arrayBuffer()) : res.json()
}

async function getPackages() {
  const cfg = loadConfig()
  const body = await request(cfg, '/IntegrationPackages')
  return body.d.results
}

// ponytail: tags reais do CPI vivem em subcolecoes (Products/Keywords/Countries/Industries/LineOfBusiness),
// cada uma exigindo uma chamada propria; resumimos tudo num unico texto pra caber no campo Package.tags.
async function getPackageTags(packageId) {
  const cfg = loadConfig()
  const groups = ['Products', 'Keywords', 'Countries', 'Industries', 'LineOfBusiness']
  const results = await Promise.all(groups.map(async group => {
    try {
      const body = await request(cfg, `/IntegrationPackages('${encodeURIComponent(packageId)}')/${group}`)
      const values = (body.d.results || []).map(r => r.Name || r.Value || r.Id).filter(Boolean)
      return values.length ? `${group}: ${values.join(', ')}` : null
    } catch {
      return null
    }
  }))
  return results.filter(Boolean).join(' | ')
}

async function getIflows(packageId) {
  const cfg = loadConfig()
  const filter = packageId ? `?$filter=PackageId eq '${encodeURIComponent(packageId)}'` : ''
  const body = await request(cfg, `/IntegrationDesigntimeArtifacts${filter}`)
  return body.d.results
}

async function getIflowZip(id, version = 'active') {
  const cfg = loadConfig()
  return request(cfg, `/IntegrationDesigntimeArtifacts(Id='${encodeURIComponent(id)}',Version='${version}')/$value`, { binary: true })
}

module.exports = { getPackages, getPackageTags, getIflows, getIflowZip }
