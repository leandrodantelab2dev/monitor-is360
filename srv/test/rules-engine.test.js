'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const AdmZip = require('adm-zip')
const { XMLParser } = require('fast-xml-parser')

const engine = require('../lib/rules-engine')
const { rules } = require('../lib/rules')

const GOOD_IFLW = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:ifl="http:///com.sap.ifl.model/Ifl.xsd">
  <bpmn2:collaboration>
    <bpmn2:participant id="Participant_1" name="Salesforce" processRef="Process_1"/>
    <bpmn2:participant id="Participant_2" name="Integration Process" processRef="Process_1"/>
    <bpmn2:messageFlow id="MessageFlow_1" sourceRef="Participant_2" targetRef="Participant_1">
      <bpmn2:extensionElements>
        <ifl:property><key>Direction</key><value>Receiver</value></ifl:property>
        <ifl:property><key>ComponentType</key><value>HTTP</value></ifl:property>
        <ifl:property><key>Address</key><value>{{salesforce_url}}</value></ifl:property>
        <ifl:property><key>password</key><value>{{salesforce_password}}</value></ifl:property>
      </bpmn2:extensionElements>
    </bpmn2:messageFlow>
  </bpmn2:collaboration>
  <bpmn2:process id="Process_1">
    <bpmn2:startEvent id="StartEvent_1" name="Start"/>
    <bpmn2:callActivity id="CallActivity_1" name="Definir Log Inicial">
      <bpmn2:extensionElements>
        <ifl:property><key>activityType</key><value>Enricher</value></ifl:property>
        <ifl:property><key>logBody</key><value>{{log_body}}</value></ifl:property>
        <ifl:property><key>logHeaders</key><value>{{log_headers}}</value></ifl:property>
      </bpmn2:extensionElements>
    </bpmn2:callActivity>
    <bpmn2:callActivity id="CallActivity_2" name="Enviar Pedido para Salesforce">
      <bpmn2:extensionElements>
        <ifl:property><key>activityType</key><value>ExternalCall</value></ifl:property>
      </bpmn2:extensionElements>
    </bpmn2:callActivity>
    <bpmn2:subProcess id="SubProcess_1" name="Exception Subprocess" triggeredByEvent="true">
      <bpmn2:startEvent id="StartEvent_Error" name="Erro"/>
    </bpmn2:subProcess>
    <bpmn2:endEvent id="EndEvent_1" name="End"/>
  </bpmn2:process>
</bpmn2:definitions>`

const GOOD_SCRIPT = `import groovy.json.JsonSlurper
def Message processData(Message message) {
    def messageLog = messageLogFactory.getMessageLog(message)
    return message
}`

const BAD_IFLW = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:ifl="http:///com.sap.ifl.model/Ifl.xsd">
  <bpmn2:collaboration>
    <bpmn2:participant id="Participant_1" name="Sender" processRef="Process_1"/>
    <bpmn2:participant id="Participant_2" name="Receiver" processRef="Process_1"/>
    <bpmn2:messageFlow id="MessageFlow_1" sourceRef="Participant_2" targetRef="Participant_1">
      <bpmn2:extensionElements>
        <ifl:property><key>Direction</key><value>Receiver</value></ifl:property>
        <ifl:property><key>ComponentType</key><value>HTTP</value></ifl:property>
        <ifl:property><key>Address</key><value>http://meusistema.com/api</value></ifl:property>
        <ifl:property><key>password</key><value>senha123</value></ifl:property>
      </bpmn2:extensionElements>
    </bpmn2:messageFlow>
  </bpmn2:collaboration>
  <bpmn2:process id="Process_1">
    <bpmn2:startEvent id="StartEvent_1" name="Start"/>
    <bpmn2:callActivity id="CallActivity_1" name="Content Modifier"/>
    <bpmn2:callActivity id="CallActivity_2" name="Request Reply">
      <bpmn2:extensionElements>
        <ifl:property><key>activityType</key><value>ExternalCall</value></ifl:property>
      </bpmn2:extensionElements>
    </bpmn2:callActivity>
    <bpmn2:endEvent id="EndEvent_1" name="End"/>
  </bpmn2:process>
</bpmn2:definitions>`

const BAD_SCRIPT_1 = `import groovy.xml.XmlSlurper
def Message processData(Message message) {
    return message
}`

const BAD_SCRIPT_2 = `import groovy.json.*
def Message processData(Message message) {
    return message
}`

function buildZip({ iflw, scripts }) {
  const zip = new AdmZip()
  zip.addFile('src/main/resources/scenarioflows/integrationflow/Test.iflw', Buffer.from(iflw))
  for (const [name, content] of Object.entries(scripts)) {
    zip.addFile(`src/main/resources/script/${name}`, Buffer.from(content))
  }
  return zip.toBuffer()
}

test('iFlow aderente as boas praticas pontua 100 e fica verde', () => {
  const zipBuffer = buildZip({ iflw: GOOD_IFLW, scripts: { 'validatePayload.groovy': GOOD_SCRIPT } })
  const { score, band, results } = engine.analyze({
    meta: { description: 'Sincroniza pedidos do Salesforce para o S/4HANA', version: '1.0.0' },
    pkg: null,
    zipBuffer
  })

  assert.equal(score, 100)
  assert.equal(band, 'verde')
  assert.ok(results.length > 0)
  assert.ok(results.every(r => r.passed))
})

test('iFlow fora das boas praticas pontua 0 e fica vermelho', () => {
  const zipBuffer = buildZip({
    iflw: BAD_IFLW,
    scripts: { 'script1.groovy': BAD_SCRIPT_1, 'genericHandler.groovy': BAD_SCRIPT_2 }
  })
  const { score, band, results } = engine.analyze({
    meta: { description: '', version: 'v1' },
    pkg: null,
    zipBuffer
  })

  assert.equal(score, 0)
  assert.equal(band, 'vermelho')
  assert.ok(results.length > 0)
  assert.ok(results.every(r => !r.passed))

  const bpm01 = results.find(r => r.ruleId === 'BPM-01')
  assert.equal(bpm01.passed, false)
})

test('regras de nivel package sao ignoradas quando nao ha pacote no contexto', () => {
  const zipBuffer = buildZip({ iflw: GOOD_IFLW, scripts: {} })
  const { results } = engine.analyze({ meta: { description: 'x', version: '1.0.0' }, pkg: null, zipBuffer })
  assert.ok(!results.some(r => r.ruleId.startsWith('PKG-')))
})

test('BPM-07 so se aplica quando ha adapters descontinuados configurados', () => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true })
  const doc = parser.parse(BAD_IFLW)

  const semLista = rules['BPM-07']({ doc, config: { adaptersDescontinuados: [] } })
  assert.equal(semLista, null)

  const comAdapterDescontinuado = rules['BPM-07']({ doc, config: { adaptersDescontinuados: ['HTTP'] } })
  assert.equal(comAdapterDescontinuado.passed, false)
})

test('band() respeita as faixas verde/amarelo/vermelho', () => {
  assert.equal(engine.band(80), 'verde')
  assert.equal(engine.band(79.9), 'amarelo')
  assert.equal(engine.band(50), 'amarelo')
  assert.equal(engine.band(49.9), 'vermelho')
})
