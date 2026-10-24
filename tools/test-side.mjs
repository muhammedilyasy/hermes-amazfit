// End-to-end test of the side service against a fake Hermes API server.
// Usage: node --import ./tools/preview/register.mjs tools/test-side.mjs
import http from 'node:http'
import assert from 'node:assert/strict'

const KEY = 'test-key'
const seen = { auth: [], idem: [], bodies: [] }
let polls = 0
let approved = null

const server = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    seen.auth.push(req.headers.authorization)
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)) }
    const html = (code, page) => { res.writeHead(code, { 'Content-Type': 'text/html' }); res.end(page) }
    // Same as Hermes 0.22.5 behind Cloudflare: /health is public, the rest needs the key.
    if (req.url === '/health') return send(200, { status: 'ok', platform: 'hermes-agent', version: '0.22.5' })
    if (req.url === '/cf/health') return html(403, '<!DOCTYPE html><title>Just a moment...</title>')
    if (req.url === '/down/health') return html(530, '<html>Error 1033: Argo Tunnel error</html>')
    if (req.headers.authorization !== 'Bearer ' + KEY) return send(401, { error: { message: 'Invalid gateway API key (API_SERVER_KEY)', type: 'gateway_auth_error', code: 'gateway_auth_failed' } })
    if (req.url === '/v1/models') return send(200, { object: 'list', data: [{ id: 'hermes-agent' }] })
    if (req.method === 'POST' && req.url === '/v1/runs') {
      seen.idem.push(req.headers['idempotency-key'])
      seen.bodies.push(JSON.parse(raw))
      return send(202, { run_id: 'run_abc', status: 'started', replayed: false })
    }
    if (req.method === 'GET' && req.url === '/v1/runs/run_abc') {
      polls++
      const run = { object: 'hermes.run', model: 'hermes-agent', run_id: 'run_abc', session_id: 'watch-x', execution_generation: 3, pending_controls: [], output: '' }
      if (polls === 1) return send(200, Object.assign(run, { status: 'running' }))
      // Entry without its own execution_generation: the run-level one must be used.
      if (!approved) return send(200, Object.assign(run, { status: 'waiting_for_approval', pending_controls: [{ kind: 'approval', prompt_id: 'p1', command: 'rm -rf build' }] }))
      return send(200, Object.assign(run, { status: 'completed', output: 'Done. Build folder removed.' }))
    }
    if (req.method === 'POST' && req.url === '/v1/runs/run_abc/approval') { approved = JSON.parse(raw); return send(200, { ok: true }) }
    if (req.method === 'POST' && req.url === '/v1/runs/run_abc/stop') return send(200, { status: 'stopping' })
    if (req.url === '/v1/runs/missing') return send(404, { error: { message: 'Run not found' } })
    send(404, { error: 'not found' })
  })
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = 'http://127.0.0.1:' + server.address().port

// Zepp's side-service fetch: one object, returns { status, body }.
globalThis.fetch = (function (nodeFetch) {
  return async ({ url, method, headers, body }) => {
    const r = await nodeFetch(url, { method, headers, body })
    return { status: r.status, body: await r.text() }
  }
})(globalThis.fetch)

let svc
globalThis.AppSideService = (o) => (svc = o)
globalThis.__SETTINGS = {}
await import('../app-side/index.js')
const call = (method, params) => new Promise((resolve) => svc.onRequest({ method, params }, (err, data) => resolve(data)))

// Not configured yet.
assert.equal((await call('CONFIG')).configured, false)
assert.match((await call('HEALTH')).error, /Set server URL/)

// Configured with a trailing /v1/ (gets normalized) and a wrong key.
__SETTINGS.url = base + '/v1/'
__SETTINGS.key = 'wrong'
assert.equal((await call('HEALTH')).error, 'Invalid gateway API key (API_SERVER_KEY)')

// Cloudflare in front: challenge page and tunnel down are reported as such.
__SETTINGS.url = base + '/cf'
assert.equal((await call('HEALTH')).error, 'Blocked by Cloudflare (403)')
__SETTINGS.url = base + '/down'
assert.equal((await call('HEALTH')).error, 'Hermes or tunnel is down (530)')
__SETTINGS.url = base

__SETTINGS.key = KEY
const cfg = await call('CONFIG')
assert.equal(cfg.configured, true)
assert.equal(cfg.commands.length, 3)
assert.deepEqual(await call('HEALTH'), { ok: true, version: '0.22.5' })
assert.equal(cfg.host, '127.0.0.1:' + server.address().port)

// Settings App "Test connection": writes testAt, side service answers in health.
svc.onSettingsChange({ key: 'testAt' })
await new Promise((r) => setTimeout(r, 200))
const health = JSON.parse(__SETTINGS.health)
assert.equal(health.ok, true); assert.equal(health.version, '0.22.5'); assert.ok(health.at > 0)
svc.onSettingsChange({ key: 'url' }) // other keys are ignored

// Start: session id is created and reused, Idempotency-Key forwarded.
const start = await call('START', { input: 'clean the build', requestId: 'req-1' })
assert.deepEqual(start, { runId: 'run_abc' })
assert.equal(seen.idem.at(-1), 'req-1')
assert.equal(seen.bodies.at(-1).input, 'clean the build')
const session = seen.bodies.at(-1).session_id
assert.match(session, /^watch-/)
await call('START', { input: 'again', requestId: 'req-2' })
assert.equal(seen.bodies.at(-1).session_id, session)

// Poll: running -> approval -> completed.
const p1 = await call('POLL', { runId: 'run_abc' })
assert.equal(p1.status, 'running'); assert.equal(p1.done, false); assert.equal(p1.control, null); assert.equal(p1.output, '')
const p2 = await call('POLL', { runId: 'run_abc' })
assert.deepEqual(p2.control, { kind: 'approval', requestId: 'p1', generation: 3, text: 'rm -rf build' })
assert.deepEqual(await call('APPROVE', { runId: 'run_abc', requestId: 'p1', generation: 3, choice: 'once' }), { ok: true })
assert.deepEqual(approved, { request_id: 'p1', execution_generation: 3, choice: 'once' })
const p3 = await call('POLL', { runId: 'run_abc' })
assert.equal(p3.done, true); assert.equal(p3.output, 'Done. Build folder removed.')

// Stop, errors, unknown method, new session.
assert.deepEqual(await call('STOP', { runId: 'run_abc' }), { ok: true })
assert.equal((await call('POLL', { runId: 'missing' })).error, 'Run not found')
assert.match((await call('NOPE')).error, /Unknown method/)
const ns = await call('NEW_SESSION')
assert.notEqual(ns.session, session)
assert.equal(__SETTINGS.session, ns.session)

assert.ok(seen.auth.every((a) => a && a.startsWith('Bearer ')))
server.close()
console.log('side service: all checks passed')
