// Chat: sends one prompt to Hermes and follows the run to its reply.
//   params { input, requestId }  start a new run
//   params { resume: true }      reopen the last run (from Home)
// Phases: starting -> running <-> control (approval / clarify) -> done | error.
// After SLOW_MS of running, polling pauses at 'slow' (Keep waiting / Stop).
// The side service starts the run and returns at once; we poll every 2 s, so long
// agent turns never hit the BLE request timeout.
import { prop } from '@zos/ui'
import { replace, back } from '@zos/router'
import { scrollTo } from '@zos/page'
import { setPageBrightTime, pauseDropWristScreenOff, resetDropWristScreenOff } from '@zos/display'
import { showToast } from '@zos/interaction'
import { BasePage } from '@zeppos/zml/base-page'
import * as L from 'zosLoader:./index.[pf].layout.js'
import { Group, textHeight, hideStatusBar } from '../../components/ui'
import { COLOR } from '../../utils/theme'
import { ask, canType, requestId } from '../../utils/input'
import { strong } from '../../utils/haptics'
import { load, save, KEY } from '../../utils/store'

const POLL_MS = 2000
const SLOW_MS = 5 * 60 * 1000
const MAX_POLL_FAILS = 5
const AWAKE_MS = 120000

const STATUS_TEXT = { starting: 'Sending', started: 'Starting', queued: 'Queued', running: 'Working', stopping: 'Stopping', waiting_for_approval: 'Waiting for approval' }

// Header status per phase: [label, color].
function headerStatus(s) {
  if (s.phase === 'done') return ['Done', COLOR.green]
  if (s.phase === 'error') return ['Error', COLOR.red]
  if (s.phase === 'control') return [s.control && s.control.kind === 'clarify' ? 'Question' : 'Approve', COLOR.amber]
  if (s.status === 'stopping') return ['Stopping', COLOR.amber]
  return ['Working', COLOR.amber]
}

function parse(params) {
  try {
    return JSON.parse(params || '{}') || {}
  } catch (e) {
    return {}
  }
}

function elapsed(since) {
  const s = Math.max(0, Math.floor((Date.now() - since) / 1000))
  return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'
}

function followUp(input) {
  replace({ url: 'page/chat/index', params: JSON.stringify({ input, requestId: requestId() }) })
}

Page(
  BasePage({
    state: {
      input: '',
      requestId: '',
      runId: '',
      phase: 'starting',
      status: 'starting',
      output: '',
      error: '',
      control: null,
      startedAt: 0
    },

    onInit(params) {
      const p = parse(params)
      const s = this.state
      s.startedAt = Date.now()
      if (p.resume) {
        const last = load(KEY.last, null) || {}
        s.input = last.input || ''
        s.runId = last.runId || ''
        if (last.status === 'completed') Object.assign(s, { phase: 'done', status: 'completed', output: last.output || '' })
        else if (!s.runId) Object.assign(s, { phase: 'error', error: last.error || 'Nothing to resume' })
        else s.phase = 'running'
      } else {
        s.input = p.input || ''
        s.requestId = p.requestId || requestId()
      }
      this.answered = ''
      this.pollFails = 0
      this.deadline = Date.now() + SLOW_MS
    },

    build() {
      hideStatusBar(L.HIDE_STATUS_BAR)
      this.head = new Group().header(L.HEADER, 'HERMES')
      setPageBrightTime({ brightTime: AWAKE_MS })
      pauseDropWristScreenOff({ duration: AWAKE_MS })
      this.ui = new Group()
      this.render()
      this.ticker = setInterval(() => this.tick(), 1000)

      const s = this.state
      if (s.phase === 'starting') this.start()
      else if (s.phase === 'running') this.poll()
    },

    onDestroy() {
      clearInterval(this.ticker)
      clearTimeout(this.pollTimer)
      resetDropWristScreenOff()
    },

    // ---- Hermes calls (through the side service) ----

    // Not "call": ZML's BasePage adds its own call() (one-way message) and it overrides page methods.
    hermes(method, params) {
      return this.request({ method, params }).then((r) => {
        if (r && r.error) throw new Error(r.error)
        return r
      })
    },

    start() {
      const s = this.state
      Object.assign(s, { phase: 'starting', status: 'starting', error: '', output: '', startedAt: Date.now() })
      this.deadline = Date.now() + SLOW_MS
      this.render()
      this.hermes('START', { input: s.input, requestId: s.requestId })
        .then((r) => {
          s.runId = r.runId
          s.phase = 'running'
          this.remember()
          this.render() // adds Stop now that there is a run to stop
          this.poll()
        })
        .catch((e) => this.fail(e.message || 'Could not reach Hermes', 'start'))
    },

    poll() {
      clearTimeout(this.pollTimer)
      const s = this.state
      this.hermes('POLL', { runId: s.runId })
        .then((r) => {
          this.pollFails = 0
          if (r.done) return this.finish(r)
          const statusChanged = r.status !== s.status
          s.status = r.status
          const c = r.control
          if (c && c.requestId !== this.answered) {
            if (!s.control || s.control.requestId !== c.requestId) {
              s.control = c
              s.phase = 'control'
              strong()
              this.render()
            }
          } else if (s.phase === 'control' && !c) {
            s.control = null
            s.phase = 'running'
            this.render()
          } else if (statusChanged) {
            this.tick()
          }
          if (s.phase === 'running' && Date.now() > this.deadline) {
            s.phase = 'slow'
            strong()
            return this.render()
          }
          this.pollTimer = setTimeout(() => this.poll(), POLL_MS)
        })
        .catch((e) => {
          this.pollFails += 1
          if (this.pollFails >= MAX_POLL_FAILS) return this.fail(e.message || 'Lost connection', 'poll')
          this.pollTimer = setTimeout(() => this.poll(), POLL_MS)
        })
    },

    finish(r) {
      const s = this.state
      s.status = r.status
      s.control = null
      if (r.status === 'completed') {
        s.phase = 'done'
        s.output = r.output || '(no text reply)'
      } else {
        s.phase = 'error'
        s.output = r.output || ''
        s.error = r.error || (r.status === 'cancelled' ? 'Stopped' : 'Run ' + r.status)
        s.retry = 'start'
      }
      this.remember()
      strong()
      setPageBrightTime({ brightTime: AWAKE_MS })
      this.render()
    },

    fail(message, retry) {
      const s = this.state
      Object.assign(s, { phase: 'error', error: message, retry })
      this.remember()
      this.render()
    },

    stop() {
      const s = this.state
      if (!s.runId) return
      s.status = 'stopping'
      if (s.phase === 'slow') this.keepWaiting()
      this.head.setStatus.apply(null, headerStatus(s))
      this.tick()
      this.hermes('STOP', { runId: s.runId }).catch(() => showToast({ content: 'Could not stop' }))
    },

    answer(choice) {
      const s = this.state
      const c = s.control
      if (!c) return
      this.answered = c.requestId
      const method = c.kind === 'clarify' ? 'CLARIFY' : 'APPROVE'
      const params = { runId: s.runId, requestId: c.requestId, generation: c.generation }
      if (method === 'CLARIFY') params.answer = choice
      else params.choice = choice
      Object.assign(s, { control: null, phase: 'running' })
      this.render()
      this.hermes(method, params).catch((e) => {
        this.answered = ''
        showToast({ content: e.message || 'Could not send' })
      })
    },

    keepWaiting() {
      this.state.phase = 'running'
      this.deadline = Date.now() + SLOW_MS
      this.render()
      this.poll()
    },

    retry() {
      const s = this.state
      this.pollFails = 0
      if (s.retry === 'poll' && s.runId) {
        Object.assign(s, { phase: 'running', error: '' })
        this.render()
        this.poll()
      } else {
        s.requestId = requestId()
        this.start()
      }
    },

    remember() {
      const s = this.state
      save(KEY.last, { runId: s.runId, input: s.input, status: s.phase === 'done' ? 'completed' : s.status, output: s.output, error: s.error })
    },

    // ---- UI ----

    statusLine() {
      const s = this.state
      return (STATUS_TEXT[s.status] || 'Working') + ' · ' + elapsed(s.startedAt)
    },

    tick() {
      const s = this.state
      if (this.statusW && (s.phase === 'starting' || s.phase === 'running')) {
        this.statusW.setProperty(prop.MORE, { text: this.statusLine() })
      }
    },

    render() {
      const ui = this.ui
      const s = this.state
      ui.clear()
      this.statusW = null
      scrollTo({ y: 0 })
      this.head.setStatus.apply(null, headerStatus(s))

      let y = L.TOP
      const label = (text) => {
        ui.text(Object.assign({ y }, L.LABEL), text)
        y += L.LABEL.h
      }
      const para = (style, value) => {
        const h = textHeight(value, style.size, L.TEXT_W, style.rows)
        ui.text({ x: L.TEXT_X, y, w: L.TEXT_W, h, text_size: style.size, color: style.color }, value)
        y += h + L.GAP
      }
      const btn = (style, text, onClick, haptic) => {
        ui.button(Object.assign({ y }, style), text, onClick, haptic)
        y += style.h + L.BUTTON_GAP
      }
      // Bordered card holding a command or a question.
      const card = (caption, value) => {
        const c = L.CONTROL
        const textW = c.w - c.pad * 2
        const capH = L.LABEL.h
        const h = textHeight(value, c.size, textW, c.rows)
        ui.card({ x: c.x, y, w: c.w, h: c.pad * 2 + capH + h, radius: c.radius, color: c.color, border: c.border, line_width: c.line_width })
        ui.text(Object.assign({}, L.LABEL, { x: c.x + c.pad, y: y + c.pad, w: textW, color: COLOR.amber }), caption)
        ui.text({ x: c.x + c.pad, y: y + c.pad + capH, w: textW, h, text_size: c.size, color: c.textColor }, value)
        y += c.pad * 2 + capH + h + L.GAP
      }

      if (s.input) {
        label('YOU')
        para(L.PROMPT, s.input)
      }

      if (s.phase === 'starting' || s.phase === 'running') {
        label('HERMES')
        this.statusW = ui.text({ x: L.TEXT_X, y, w: L.TEXT_W, h: L.STATUS.h, text_size: L.STATUS.size, color: L.STATUS.color }, this.statusLine())
        if (s.runId) ui.button(L.STOP, 'Stop', () => this.stop(), 'tick')
        return
      }

      if (s.phase === 'control') {
        const c = s.control
        if (c.kind === 'clarify') {
          card('HERMES ASKS', c.text)
          if (canType) {
            btn(L.PRIMARY, 'Answer by voice', () => ask('voice', (t) => this.answer(t)))
            btn(L.SECONDARY, 'Type', () => ask('text', (t) => this.answer(t)), 'tick')
          } else {
            para(L.NOTE, "This watch can't type an answer (needs Zepp OS 4). Answer Hermes elsewhere, or stop the run.")
            btn(L.DANGER, 'Stop', () => this.stop(), 'tick')
          }
        } else {
          card('WANTS TO RUN', c.text)
          ui.button(Object.assign({ y }, L.DENY), 'Deny', () => this.answer('deny'))
          ui.button(Object.assign({ y }, L.APPROVE), 'Approve', () => this.answer('once'))
          y += L.APPROVE.h
        }
      } else if (s.phase === 'slow') {
        label('HERMES')
        para(L.NOTE, 'Still working after ' + elapsed(s.startedAt) + '. It keeps going if you leave.')
        btn(L.PRIMARY, 'Keep waiting', () => this.keepWaiting())
        btn(L.DANGER, 'Stop', () => this.stop(), 'tick')
      } else if (s.phase === 'done') {
        label('HERMES')
        para(L.REPLY, s.output)
        if (canType) {
          btn(L.PRIMARY, 'Reply by voice', () => ask('voice', followUp))
          btn(L.SECONDARY, 'Type', () => ask('text', followUp), 'tick')
        } else {
          btn(L.SECONDARY, 'Done', () => back(), 'tick')
        }
      } else {
        label('HERMES')
        para(L.ERROR, s.error)
        if (s.output) para(L.REPLY, s.output)
        if (s.input || s.runId) btn(L.PRIMARY, 'Retry', () => this.retry())
      }

      // Spacer so the page scrolls the last button clear of the rounded corners.
      ui.text({ x: 0, y, w: 1, h: L.BOTTOM_PAD }, '')
    }
  })
)
