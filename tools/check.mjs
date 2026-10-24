// Static checks the Zeus build does not do (both would only fail at runtime on the watch):
//   1. Every L.NAME a page uses is exported by its square layout file.
//   2. Every named import from a relative path is exported by that file.
// Usage: node --import ./tools/preview/register.mjs tools/check.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
globalThis.__PV = { width: 390, dw: 390, widgets: [], widths: {} }
let problems = 0
const report = (file, msg) => { problems++; console.log(path.relative(root, file) + ': ' + msg) }

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (['node_modules', 'dist', 'tools', 'design', 'assets', '.git'].includes(name)) continue
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.js')) out.push(p)
  }
  return out
}

for (const file of walk(root)) {
  const src = fs.readFileSync(file, 'utf8')
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(\.[^']+)'/g)) {
    const target = path.resolve(path.dirname(file), m[2].endsWith('.js') ? m[2] : m[2] + '.js')
    if (!fs.existsSync(target)) { report(file, `cannot resolve '${m[2]}'`); continue }
    const mod = await import(pathToFileURL(target).href)
    m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach((n) => {
      if (!(n in mod)) report(file, `'${n}' is not exported by ${path.relative(root, target)}`)
    })
  }
  const loader = src.match(/from\s*'zosLoader:(\.\/[^']+)\[pf\]\.layout\.js'/)
  if (loader) {
    const layout = path.resolve(path.dirname(file), loader[1] + 's.layout.js')
    const mod = await import(pathToFileURL(layout).href)
    for (const n of new Set([...src.matchAll(/\bL\.([A-Z_][A-Z0-9_]*)/g)].map((m) => m[1]))) {
      if (!(n in mod)) report(file, `L.${n} is not exported by ${path.relative(root, layout)}`)
    }
  }
}
console.log(problems ? problems + ' problem(s)' : 'check: all good')
process.exit(problems ? 1 : 0)
