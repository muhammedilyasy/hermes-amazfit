// Approximate preview of the phone Settings App: runs setting/index.js with View/Text/...
// mocked as HTML builders, and prints an HTML page. The real Zepp renderer differs in
// details (TextInput opens a dialog), so this checks layout and styling only.
// Usage: node --import ./tools/preview/register.mjs tools/preview/settings-html.mjs '<storageJSON>' > out.html
const storeIn = JSON.parse(process.argv[2] || '{}')
const css = (style = {}) =>
  Object.entries(style).map(([k, v]) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ':' + String(v).replace(/"/g, "'")).join(';')
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const kids = (c) => (Array.isArray(c) ? c : c ? [c] : []).filter(Boolean).join('')

globalThis.View = (p, c) => `<div style="${css(p && p.style)}">${kids(c)}</div>`
globalThis.Text = (p, t) => `<div style="${css(Object.assign({ textAlign: p.align || 'left' }, p.style))}">${esc(t)}</div>`
globalThis.Image = (p) => `<img src="${p.src}" width="${p.width}" height="${p.height}" style="image-rendering:pixelated;${css(p.style)}">`
globalThis.Button = (p) => `<button style="font-family:inherit;${css(p.style)}">${esc(p.label)}</button>`
globalThis.TextInput = (p) =>
  `<div>${p.label ? `<div style="${css(p.labelStyle)}">${esc(p.label)}</div>` : ''}<div style="${css(p.subStyle)}">${
    p.value ? esc(p.value) : `<span style="opacity:.45">${esc(p.placeholder || '')}</span>`
  }</div></div>`
let page
globalThis.AppSettingsPage = (o) => (page = o)
await import('../../setting/index.js')
const storage = { getItem: (k) => (k in storeIn ? storeIn[k] : null), setItem() {} }
process.stdout.write(`<!doctype html><meta name=viewport content="width=390"><style>*{box-sizing:border-box}</style><body style="margin:0;background:#333"><div style="width:390px;overflow:hidden">${page.build({ settingsStorage: storage })}</div></body>`)
