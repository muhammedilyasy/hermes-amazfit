// Node module hooks for the preview tool: maps @zos/* and ZML to mocks, resolves
// zosLoader:[pf] layout imports for the chosen shape, and treats project .js as ESM.
import { readFile } from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const shape = process.env.PV_SHAPE || 's'

export async function resolve(spec, ctx, next) {
  if (spec.startsWith('@zos/')) return { url: pathToFileURL(path.join(here, 'zos-mock.mjs')).href, shortCircuit: true }
  if (spec.startsWith('@zeppos/zml')) return { url: pathToFileURL(path.join(here, 'zml-mock.mjs')).href, shortCircuit: true }
  if (spec.startsWith('zosLoader:')) spec = spec.slice('zosLoader:'.length).replace('[pf]', shape)
  if ((spec.startsWith('./') || spec.startsWith('../')) && !/\.(m?js|json)$/.test(spec)) spec += '.js'
  return next(spec, ctx)
}

export async function load(url, ctx, next) {
  if (url.startsWith('file:') && url.endsWith('.js') && fileURLToPath(url).startsWith(root)) {
    return { format: 'module', source: await readFile(fileURLToPath(url), 'utf8'), shortCircuit: true }
  }
  return next(url, ctx)
}
