// Run one page with mocked Zepp APIs and print its widgets as JSON.
// Usage: PV_DEVICE=bip6 PV_API=4 node --import ./register.mjs run.mjs <page> [paramsJSON] [storeJSON] [responsesJSON]
// Timers are inert, so a page shows the state reached after
// its first round of (scripted) requests.
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const [page, paramsJson = '', storeJson = '{}', responsesJson = '{}'] = process.argv.slice(2)
// PV_DEVICE picks the watch. dw is the design width of the matching app.json platform.
const DEVICES = {
  bip6: { shape: 's', width: 390, height: 450, dw: 390 },
  bip5unity: { shape: 's', width: 320, height: 380, dw: 390 },
  bipmax: { shape: 's', width: 432, height: 514, dw: 390 },
  balance2: { shape: 'r', width: 480, height: 480, dw: 480 },
  active2: { shape: 'r', width: 466, height: 466, dw: 480 },
  falcon: { shape: 'r', width: 416, height: 416, dw: 480 }
}
const dev = DEVICES[process.env.PV_DEVICE || 'bip6']
process.env.PV_SHAPE = dev.shape

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
