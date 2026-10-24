// Run one page with mocked Zepp APIs and print its widgets as JSON.
// Usage: node --import ./register.mjs run.mjs <page> [paramsJSON] [storeJSON] [responsesJSON]
// Bip 6 only (square 390 x 450). Timers are inert, so a page shows the state reached after
// its first round of (scripted) requests.
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const [page, paramsJson = '', storeJson = '{}', responsesJson = '{}'] = process.argv.slice(2)
const dev = { shape: 's', width: 390, height: 450, dw: 390 }

globalThis.__PV = Object.assign({}, dev, {
  widgets: [], nav: [], toasts: [],
  widths: JSON.parse(readFileSync('/tmp/sw-fonts/widths.json', 'utf8')),
  statusTitle: '', statusVisible: true,
  store: JSON.parse(storeJson),
  responses: JSON.parse(responsesJson),
  nowMs: Date.now()
})
globalThis.setInterval = () => 0
globalThis.setTimeout = () => 0
globalThis.clearInterval = () => {}
globalThis.clearTimeout = () => {}
let pageObj = null
globalThis.Page = (o) => (pageObj = o)
globalThis.App = () => {}
globalThis.getApp = () => ({ _options: { globalData: {} } })

await import(pathToFileURL(path.join(root, page + '.js')).href)
const params = paramsJson || undefined
pageObj.onInit && pageObj.onInit.call(pageObj, params)
pageObj.build && pageObj.build.call(pageObj, params)
// PV_ADVANCE_MS: jump the clock forward after build (e.g. to reach the 'slow' phase).
const skew = Number(process.env.PV_ADVANCE_MS || 0)
if (skew) { const real = Date.now; Date.now = () => real() + skew }
for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r))

const S = globalThis.__PV
const out = S.widgets.filter((w) => !w._deleted)
process.stdout.write(JSON.stringify({ device: dev, status: { title: S.statusTitle, visible: S.statusVisible }, widgets: out, nav: S.nav }))
