'use strict'

const cds = require('@sap/cds')
const sapClient = require('./lib/sap-client')
const engine = require('./lib/rules-engine')

async function analyzeOne(srv, ID) {
  const { Iflows, RuleResults, Packages } = srv.entities

  const iflow = await SELECT.one.from(Iflows).where({ ID })
  if (!iflow) throw new Error(`iFlow "${ID}" nao encontrado no inventario local. Rode "Sincronizar com CPI" primeiro.`)

  const pkg = iflow.package_ID ? await SELECT.one.from(Packages).where({ ID: iflow.package_ID }) : null
  const zipBuffer = await sapClient.getIflowZip(ID)

  const { score, band, results } = engine.analyze({
    meta: { description: iflow.description, version: iflow.version },
    pkg: pkg ? { description: pkg.description, tags: pkg.tags } : null,
    zipBuffer
  })

  await DELETE.from(RuleResults).where({ iflow_ID: ID })
  if (results.length) {
    await INSERT.into(RuleResults).entries(results.map(r => ({ iflow_ID: ID, ...r })))
  }
  await UPDATE(Iflows, ID).with({ score, band, analyzedAt: new Date().toISOString() })

  return SELECT.one.from(Iflows).where({ ID })
}

module.exports = function () {
  const { Packages, Iflows } = this.entities

  this.on('syncInventory', async () => {
    const packages = await sapClient.getPackages()
    const allIflows = await sapClient.getIflows()
    const syncedAt = new Date().toISOString()

    for (const pkg of packages) {
      const tags = await sapClient.getPackageTags(pkg.Id)
      await UPSERT.into(Packages).entries({
        ID: pkg.Id,
        name: pkg.Name,
        description: pkg.ShortText || pkg.Description,
        version: pkg.Version,
        tags,
        syncedAt
      })
    }

    for (const iflow of allIflows) {
      await UPSERT.into(Iflows).entries({
        ID: iflow.Id,
        package_ID: iflow.PackageId,
        name: iflow.Name,
        description: iflow.Description,
        version: iflow.Version,
        syncedAt
      })
    }

    console.log(`[monitor-is360] syncInventory: ${packages.length} pacotes, ${allIflows.length} iFlows sincronizados do CPI`)
    return { packages: packages.length, iflows: allIflows.length }
  })

  this.on('analyzeIflow', async req => analyzeOne(this, req.data.ID))

  this.on('analyzeAll', async () => {
    const list = await SELECT.from(Iflows)
    let analisados = 0
    let falhas = 0
    for (const iflow of list) {
      try {
        await analyzeOne(this, iflow.ID)
        analisados++
      } catch (err) {
        falhas++
        console.error(`[monitor-is360] falha ao analisar iFlow "${iflow.ID}": ${err.message}`)
      }
    }
    console.log(`[monitor-is360] analyzeAll: ${analisados} analisados, ${falhas} falhas`)
    return { analisados, falhas }
  })
}
