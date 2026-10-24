// Side Service (runs inside the Zepp phone app). The watch has no internet of its own,
// so every Hermes call goes watch -> BLE -> here -> HTTPS -> Hermes API server.
//
// Uses the Hermes Runs API (async), so a long agent turn never hits the 60 s BLE
// request timeout: START returns a run id at once and the watch POLLs it.
//   POST /v1/runs                  { input, session_id } -> { run_id }
//   GET  /v1/runs/{id}             status, output, pending_controls
//   POST /v1/runs/{id}/stop
//   POST /v1/runs/{id}/approval    { request_id, execution_generation, choice }
//   POST /v1/runs/{id}/clarify     { request_id, execution_generation, answer }
//
// Server URL, API key, session id and quick commands live in settingsStorage and are
// edited in the Settings App (setting/index.js). The key never reaches the watch.
import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { DEFAULT_COMMANDS, KEY, MAX_OUTPUT, newSessionId } from '../utils/shared'

function readJSON(key, fallback) {
  try {
    return JSON.parse(settingsLib.getItem(key) || 'null') || fallback
  } catch (e) {
    return fallback
  }
}

// "https://host:8642/v1/" -> "https://host:8642"
function baseUrl() {
  return (settingsLib.getItem(KEY.url) || '').trim().replace(/\/+$/, '').replace(/\/v1$/, '')
}

function session() {
  let id = settingsLib.getItem(KEY.session)
  if (!id) {
    id = newSessionId()
    settingsLib.setItem(KEY.session, id)
  }
  return id
}

// The domain sits behind a Cloudflare Tunnel. Cloudflare answers with HTML instead of
// Hermes' JSON when it blocks the phone (Bot Fight Mode / WAF challenge) or when the
// tunnel or Hermes is down, so tell those apart from Hermes errors.
function cloudflareText(status, body) {
  if (typeof body !== 'string' || body.trim().charAt(0) !== '<') return ''
  if (status === 403 || status === 503 || /challenge|just a moment|attention required/i.test(body)) return 'Blocked by Cloudflare (' + status + ')'
  if (status === 502 || status === 504 || status === 530) return 'Hermes or tunnel is down (' + status + ')'
  return ''
}

function errorText(status, body) {
  const cf = cloudflareText(status, body)
  if (cf) return cf
  if (body && typeof body === 'object') {
    const e = body.error
    if (e && typeof e === 'object' && e.message) return e.message
    if (typeof e === 'string') return e
    if (body.detail) return typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    if (body.message) return body.message
  }
  if (status === 401 || status === 403) return 'API key rejected (' + status + ')'
  if (status === 429) return 'Hermes is busy (too many runs)'
  return 'HTTP ' + status
}

async function api(path, method, body, extraHeaders) {
  const url = baseUrl()
  const key = (settingsLib.getItem(KEY.key) || '').trim()
  if (!url || !key) throw new Error('Set server URL and API key in the Zepp app')

  const res = await fetch({
    url: url + path,
    method: method || 'GET',
    headers: Object.assign({ Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, extraHeaders || {}),
    body: body ? JSON.stringify(body) : undefined
  })
  let data = res.body
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch (e) {
      // plain-text body, keep as is
    }
  }
  if (res.status && res.status >= 400) throw new Error(errorText(res.status, data))
  // A 200 HTML page means something in front of Hermes answered instead (a challenge).
  if (typeof data === 'string' && data.trim().charAt(0) === '<') throw new Error('Blocked by Cloudflare (challenge page)')
  return data
}

// Run output can be a string or a Responses-style item list. Flatten to plain text.
function textOf(x) {
  if (x == null) return ''
  if (typeof x === 'string') return x
  if (Array.isArray(x)) return x.map(textOf).filter(Boolean).join('\n')
  if (typeof x === 'object') {
    if (x.type === 'function_call' || x.type === 'function_call_output') return ''
    if (typeof x.text === 'string') return x.text
    if (x.content != null) return textOf(x.content)
    if (typeof x.output === 'string') return x.output
  }
  return ''
}

function clip(s) {
  return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + '…' : s
}

// pending_controls is [] on Hermes 0.22.5 when nothing is pending. An entry carries
// prompt_id (+ execution_generation, which is also on the run itself). The entry's other
// fields were not seen live (smart approvals auto-approved the test), so accept an
// array, a single object, or an object keyed by id, and look for the text in several
// likely fields.
function pendingControl(run) {
  let list = run.pending_controls
  if (!list) return null
  if (!Array.isArray(list)) list = list.prompt_id || list.request_id ? [list] : Object.values(list)
  const c = list.find((x) => x && typeof x === 'object')
  if (!c) return null
  const kind = String(c.kind || c.type || c.method || '').toLowerCase().indexOf('clarif') >= 0 ? 'clarify' : 'approval'
  return {
    kind,
    requestId: c.prompt_id || c.request_id || c.id,
    generation: c.execution_generation != null ? c.execution_generation : run.execution_generation,
    text: c.command || c.question || c.description || c.prompt || c.message || c.title || JSON.stringify(c).slice(0, 300)
  }
}

const TERMINAL = ['completed', 'failed', 'cancelled', 'interrupted']

function summarize(run) {
  const status = run.status || 'unknown'
  const out = {
    status,
    done: TERMINAL.indexOf(status) >= 0,
    output: clip(textOf(run.output).trim()),
    control: pendingControl(run)
  }
  if (status !== 'completed' && run.error) out.error = typeof run.error === 'string' ? run.error : run.error.message || JSON.stringify(run.error)
  if (!out.error && status === 'failed' && run.turn_exit_reason) out.error = String(run.turn_exit_reason)
  return out
}

const handlers = {
  // host is shown on the watch under the header; the key never leaves the phone.
  CONFIG() {
    return {
      configured: !!(baseUrl() && settingsLib.getItem(KEY.key)),
      host: baseUrl().replace(/^https?:\/\//, '').split('/')[0],
      commands: readJSON(KEY.commands, DEFAULT_COMMANDS).slice(0, 8)
    }
  },

  // /health is unauthenticated, so also hit /v1/models to check the key. Both are free;
  // never start a run just to check (each run costs ~18k tokens).
  async HEALTH() {
    const h = await api('/health')
    await api('/v1/models')
    return { ok: true, version: (h && h.version) || '' }
  },

  // params: { input, requestId } -- requestId doubles as the Idempotency-Key, so a
  // retried START never runs the same prompt twice.
  async START({ input, requestId }) {
    const run = await api('/v1/runs', 'POST', { input, session_id: session() }, requestId ? { 'Idempotency-Key': requestId } : null)
    if (!run || !run.run_id) throw new Error('Hermes did not return a run id')
    return { runId: run.run_id }
  },

  async POLL({ runId }) {
    return summarize(await api('/v1/runs/' + encodeURIComponent(runId)))
  },

  async STOP({ runId }) {
    await api('/v1/runs/' + encodeURIComponent(runId) + '/stop', 'POST', {})
    return { ok: true }
  },

  // params: { runId, requestId, generation, choice: 'once' | 'deny' }
  async APPROVE({ runId, requestId, generation, choice }) {
    await api('/v1/runs/' + encodeURIComponent(runId) + '/approval', 'POST', {
      request_id: requestId,
      execution_generation: generation,
      choice
    })
    return { ok: true }
  },

  async CLARIFY({ runId, requestId, generation, answer }) {
    await api('/v1/runs/' + encodeURIComponent(runId) + '/clarify', 'POST', {
      request_id: requestId,
      execution_generation: generation,
      answer
    })
    return { ok: true }
  },

  NEW_SESSION() {
    const id = newSessionId()
    settingsLib.setItem(KEY.session, id)
    return { session: id }
  }
}

AppSideService(
  BaseSideService({
    onInit() {},

    // Always answer with res(null, data); failures travel as { error } so the watch
    // has one code path.
    onRequest(req, res) {
      const handler = handlers[req.method]
      if (!handler) return res(null, { error: 'Unknown method ' + req.method })
      Promise.resolve()
        .then(() => handler(req.params || {}))
        .then((data) => res(null, data))
        .catch((e) => res(null, { error: (e && e.message) || String(e) }))
    },

    // The Settings App can't make network calls, so its "Test connection" button writes
    // testAt and we answer with the HEALTH result in health.
    onSettingsChange({ key }) {
      if (key !== KEY.testAt) return
      const write = (r) => settingsLib.setItem(KEY.health, JSON.stringify(Object.assign({ at: Date.now() }, r)))
      Promise.resolve()
        .then(() => handlers.HEALTH())
        .then(write)
        .catch((e) => write({ ok: false, error: (e && e.message) || String(e) }))
    },

    onRun() {},
    onDestroy() {}
  })
)
