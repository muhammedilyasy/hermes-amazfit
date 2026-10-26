// The conversation, like Messages on Apple Watch: blue bubbles for you, gray for the agent,
// a typing indicator while it works, Allow / Deny for commands it wants to run, smart
// replies (your quick commands), and an "iMessage" field + mic at the bottom.
//
// One run at a time. The side service starts it and returns at once; we poll every 2 s,
// so long agent turns never hit the BLE request timeout. Thread and the run in progress
// are kept in LocalStorage, so reopening the app resumes where it left off.
// Watches without the system keyboard (API < 4.0) get smart replies only.
import { prop, align } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { scrollTo } from '@zos/page'
import { setPageBrightTime, pauseDropWristScreenOff, resetDropWristScreenOff } from '@zos/display'
import { showToast } from '@zos/interaction'
import { BasePage } from '@zeppos/zml/base-page'
import * as L from 'zosLoader:./index.[pf].layout.js'
import { Group, hideStatusBar, textHeight } from '../../components/ui'
import { COLOR } from '../../utils/theme'
import { ask, canType, requestId } from '../../utils/input'
import { strong } from '../../utils/haptics'
import { load, save, KEY } from '../../utils/store'
import { stamp, stampLabel, now } from '../../utils/clock'
import { AGENT } from '../../utils/agent'

const POLL_MS = 2000
const SLOW_MS = 5 * 60 * 1000
const MAX_POLL_FAILS = 5
const AWAKE_MS = 120000
const MAX_THREAD = 40
const STAMP_GAP_MS = 15 * 60 * 1000
const MAX_SMART_REPLIES = 4

let seq = 0
const newId = () => 'm' + Date.now().toString(36) + (seq++).toString(36)

function elapsed(since) {
  const s = Math.max(0, Math.floor((Date.now() - since) / 1000))
  return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'
}

Page(
  BasePage({
    state: {},

    build() {
      hideStatusBar(L.HIDE_STATUS_BAR)
      setPageBrightTime({ brightTime: AWAKE_MS })
      pauseDropWristScreenOff({ duration: AWAKE_MS })
      this.screenH = getDeviceInfo().height

      this.thread = load(KEY.thread, [])
      this.run = load(KEY.run, null)
      this.name = (load(KEY.agent, null) || AGENT).name || AGENT.name
      this.commands = []
      this.control = null
      this.answered = ''
      this.slow = false
      this.pollFails = 0
      this.conn = { text: 'Connecting…', color: COLOR.secondary }

      this.head = new Group().header(L.HEADER)
      this.head.setName(this.name)
      this.head.setTime(now())
      this.ui = new Group()
      this.render()

      this.clock = setInterval(() => this.head.setTime(now()), 10000)
      this.ticker = setInterval(() => this.tick(), 400)
      if (this.run && this.run.runId) {
        this.deadline = Date.now() + SLOW_MS
        this.poll()
      } else if (this.run) {
        // The app closed before the run started: treat the message as not delivered.
        this.failMessage(this.run.msgId, 'Not sent')
      }
      this.connect()
    },

    onDestroy() {
      clearInterval(this.clock)
      clearInterval(this.ticker)
      clearTimeout(this.pollTimer)
      resetDropWristScreenOff()
    },

    // ---- Phone / Hermes ----

    // Not "call": ZML's BasePage adds its own call() (one-way message) and it overrides page methods.
    hermes(method, params) {
      return this.request({ method, params }).then((r) => {
        if (r && r.error) throw new Error(r.error)
        return r
      })
    },

    connect() {
      this.hermes('CONFIG')
        .then((cfg) => {
          this.commands = cfg.commands || []
          if (cfg.name && cfg.name !== this.name) {
            this.name = cfg.name
            save(KEY.agent, { name: cfg.name })
            this.head.setName(cfg.name)
          }
          if (!cfg.configured) return this.setConn('Set up in the Zepp app', COLOR.orange)
          return this.hermes('HEALTH')
            .then(() => this.setConn('Online', COLOR.secondary))
            .catch((e) => this.setConn(e.message || 'Offline', COLOR.red))
        })
        .catch(() => this.setConn('Phone not connected', COLOR.red))
        .then(() => this.render())
    },

    setConn(text, color) {
      this.conn = { text, color }
      this.updateSub()
    },

    updateSub() {
      if (this.run && !this.control) this.head.setSub('typing…', COLOR.secondary)
      else this.head.setSub(this.conn.text, this.conn.color)
    },

    // ---- Thread ----

    push(item) {
      this.thread.push(Object.assign({ id: newId() }, stamp(), item))
      if (this.thread.length > MAX_THREAD) this.thread = this.thread.slice(-MAX_THREAD)
      this.persist()
    },

    find(id) {
      return this.thread.find((m) => m.id === id)
    },

    persist() {
      save(KEY.thread, this.thread)
      save(KEY.run, this.run)
    },

    failMessage(msgId, error) {
      const m = this.find(msgId)
      if (m) Object.assign(m, { state: 'failed', error })
      this.run = null
      this.persist()
      this.render()
    },

    // ---- Sending ----

    send(text) {
      if (this.control && this.control.kind === 'clarify') return this.answerQuestion(text)
      if (this.run) return showToast({ content: this.name + ' is still replying' })
      this.start(text)
    },

    start(text) {
      this.push({ from: 'me', text, state: 'sending' })
      const msg = this.thread[this.thread.length - 1]
      this.run = { msgId: msg.id, requestId: requestId(), runId: '', startedAt: Date.now() }
      this.slow = false
      this.deadline = Date.now() + SLOW_MS
      this.persist()
      this.render()
      this.hermes('START', { input: text, requestId: this.run.requestId })
        .then((r) => {
          msg.state = 'sent'
          this.run.runId = r.runId
          this.persist()
          this.render()
          this.poll()
        })
        .catch((e) => this.failMessage(msg.id, e.message || 'Not delivered'))
    },

    retry(id) {
      const m = this.find(id)
      if (!m || this.run) return
      this.thread = this.thread.filter((x) => x.id !== id)
      this.start(m.text)
    },

    poll() {
      clearTimeout(this.pollTimer)
      if (!this.run || !this.run.runId) return
      this.hermes('POLL', { runId: this.run.runId })
        .then((r) => {
          this.pollFails = 0
          if (!this.run) return
          if (r.done) return this.finish(r)
          const c = r.control
          if (c && c.requestId !== this.answered) {
            if (!this.control || this.control.requestId !== c.requestId) {
              this.control = c
              strong()
              this.render()
            }
          } else if (this.control && !c) {
            this.control = null
            this.render()
          }
          if (!this.control && Date.now() > this.deadline) {
            this.slow = true
            strong()
            return this.render()
          }
          this.pollTimer = setTimeout(() => this.poll(), POLL_MS)
        })
        .catch(() => {
          this.pollFails += 1
          if (this.pollFails >= MAX_POLL_FAILS) {
            this.slow = true // shows "Check again" / "Stop"
            return this.render()
          }
          this.pollTimer = setTimeout(() => this.poll(), POLL_MS)
        })
    },

    finish(r) {
      this.run = null
      this.control = null
      this.slow = false
      if (r.status === 'completed') this.push({ from: 'agent', text: r.output || '(no reply)' })
      else if (r.status === 'cancelled') this.push({ from: 'note', text: 'Stopped' })
      else this.push({ from: 'note', tone: 'red', text: r.error || 'Failed (' + r.status + ')' })
      strong()
      setPageBrightTime({ brightTime: AWAKE_MS })
      this.persist()
      this.render()
    },

    stop() {
      if (!this.run || !this.run.runId) return
      this.hermes('STOP', { runId: this.run.runId }).catch(() => showToast({ content: 'Could not stop' }))
      showToast({ content: 'Stopping…' })
      if (this.slow) this.keepWaiting()
    },

    keepWaiting() {
      this.slow = false
      this.pollFails = 0
      this.deadline = Date.now() + SLOW_MS
      this.render()
      this.poll()
    },

    allow(choice) {
      const c = this.control
      if (!c || !this.run) return
      this.answered = c.requestId
      this.control = null
      this.push({ from: 'note', text: choice === 'once' ? 'You allowed it' : 'You denied it' })
      this.render()
      this.hermes('APPROVE', { runId: this.run.runId, requestId: c.requestId, generation: c.generation, choice }).catch((e) => {
        this.answered = ''
        showToast({ content: e.message || 'Could not send' })
      })
    },

    answerQuestion(text) {
      const c = this.control
      if (!c || !this.run) return
      this.answered = c.requestId
      this.control = null
      this.push({ from: 'me', text, state: 'sent' })
      this.render()
      this.hermes('CLARIFY', { runId: this.run.runId, requestId: c.requestId, generation: c.generation, answer: text }).catch((e) => {
        this.answered = ''
        showToast({ content: e.message || 'Could not send' })
      })
    },

    newConversation() {
      if (this.run) return showToast({ content: this.name + ' is still replying' })
      this.hermes('NEW_SESSION')
        .then(() => {
          this.thread = []
          this.persist()
          this.render()
          showToast({ content: 'New conversation' })
        })
        .catch(() => showToast({ content: 'Phone not connected' }))
    },

    // ---- UI ----

    tick() {
      if (this.typingUI) this.typingUI.animate(++this.dotStep || (this.dotStep = 1))
      if (this.elapsedW && this.run) this.elapsedW.setProperty(prop.MORE, { text: elapsed(this.run.startedAt) })
    },

    render() {
      const ui = this.ui
      const B = L.BUBBLE
      ui.clear()
      this.typingUI = null
      this.elapsedW = null
      this.updateSub()

      let y = L.TOP
      let prev = null // previous bubble sender, for spacing and tails
      let focus = 0 // top of the newest message: never scroll past it (0 keeps the header in view)
      const note = (text, color) => {
        const h = textHeight(text, L.NOTE.size, L.NOTE.w)
        ui.text({ x: L.NOTE.x, y, w: L.NOTE.w, h, text_size: L.NOTE.size, color, align_h: align.CENTER_H }, text)
        y += h + B.gapOther
        prev = null
      }
      const space = (from) => {
        if (prev) y += prev === from ? B.gapSame : B.gapOther
      }

      if (!this.thread.length && !this.run) {
        y += B.gapOther
        note(canType ? 'Send a message to ' + this.name + '.' : 'Tap a reply to message ' + this.name + '.', COLOR.secondary)
      }

      const items = this.thread
      items.forEach((m, i) => {
        focus = y
        const before = items[i - 1]
        if (!before || m.at - before.at > STAMP_GAP_MS) {
          if (before) y += B.gapOther
          ui.text({ x: L.STAMP.x, y, w: L.STAMP.w, h: L.STAMP.h, text_size: L.STAMP.size, color: L.STAMP.color, align_h: align.CENTER_H, align_v: align.CENTER_V }, stampLabel(m))
          y += L.STAMP.h
          prev = null
        }
        if (m.from === 'note') {
          if (prev) y += B.gapOther
          return note(m.text, m.tone === 'red' ? COLOR.red : COLOR.secondary)
        }
        const mine = m.from === 'me'
        space(m.from)
        const next = items[i + 1]
        const last = !next || next.from !== m.from || (next.at - m.at > STAMP_GAP_MS)
        const box = ui.bubble(B, { y, text: m.text, mine, tail: last || m.state === 'failed' })
        y += box.h
        prev = m.from

        const isLastMine = mine && !items.slice(i + 1).some((x) => x.from !== 'note')
        if (mine && m.state === 'failed') {
          const label = 'Not Delivered · Tap to retry'
          ui.text({ x: B.left, y, w: B.right - B.left, h: L.META.h, text_size: L.META.size, color: COLOR.red, align_h: align.RIGHT, align_v: align.CENTER_V }, label)
          ui.tap({ x: box.x, y: box.y, w: box.w, h: box.h + L.META.h }, () => this.retry(m.id))
          y += L.META.h
          prev = null
        } else if (isLastMine && (m.state === 'sent' || m.state === 'sending')) {
          const label = m.state === 'sent' ? 'Delivered' : 'Sending…'
          ui.text({ x: B.left, y, w: B.right - B.left, h: L.META.h, text_size: L.META.size, color: COLOR.secondary, align_h: align.RIGHT, align_v: align.CENTER_V }, label)
          y += L.META.h
          prev = null
        }
      })

      // The run in progress: a question, a permission request, or the typing indicator.
      if (this.run) {
        focus = y
        const c = this.control
        if (c) {
          space('agent')
          const text = c.kind === 'clarify' ? c.text : 'Can I run this?\n\n' + c.text
          y += ui.bubble(B, { y, text, mine: false, tail: true }).h
          prev = 'agent'
          if (c.kind !== 'clarify') {
            y += L.PILL.gap * 2
            const half = Math.floor((L.PILL.w - L.HALF_GAP) / 2)
            ui.pill(Object.assign({}, L.PILL, { y, w: half, color: COLOR.pill, textColor: COLOR.red }), 'Deny', () => this.allow('deny'))
            ui.pill(Object.assign({}, L.PILL, { x: L.PILL.x + half + L.HALF_GAP, y, w: half, color: COLOR.blue, textColor: COLOR.text }), 'Allow', () => this.allow('once'))
            y += L.PILL.h
            prev = null
          }
        } else if (this.slow) {
          y += B.gapOther
          note(this.name + ' is still working (' + elapsed(this.run.startedAt) + '). It keeps going if you leave.', COLOR.secondary)
          ui.pill(Object.assign({}, L.PILL, { y, color: COLOR.pill, textColor: COLOR.text }), 'Check again', () => this.keepWaiting())
          y += L.PILL.h + L.PILL.gap
          ui.pill(Object.assign({}, L.PILL, { y, color: COLOR.pill, textColor: COLOR.red }), 'Stop', () => this.stop(), 'tick')
          y += L.PILL.h
          prev = null
        } else if (this.run.runId) {
          space('agent')
          this.typingUI = ui.typing(B, L.TYPING, y)
          // Elapsed time beside the dots, Stop on the right.
          const stopW = Math.floor(L.PILL.w / 3)
          this.elapsedW = ui.text({ x: B.left + L.TYPING.w + L.PILL.gap * 2, y, w: stopW, h: L.TYPING.h, text_size: L.META.size, color: COLOR.secondary, align_v: align.CENTER_V }, elapsed(this.run.startedAt))
          ui.pill(Object.assign({}, L.PILL, { x: B.right - stopW, y, w: stopW, h: L.TYPING.h, radius: Math.floor(L.TYPING.h / 2), color: COLOR.pill, textColor: COLOR.red }), 'Stop', () => this.stop(), 'tick')
          y += L.TYPING.h
          prev = 'agent'
        }
      }

      // Smart replies (your quick commands) when nothing is running.
      y += L.PILL.gap * 3
      if (!this.run && this.commands.length) {
        this.commands.slice(0, MAX_SMART_REPLIES).forEach((cmd) => {
          ui.pill(Object.assign({}, L.PILL, { y, color: COLOR.pill, textColor: COLOR.text }), cmd, () => this.send(cmd))
          y += L.PILL.h + L.PILL.gap
        })
        y += L.PILL.gap
      }

      // Message field + mic, or a hint on watches without a keyboard.
      if (canType) {
        const answering = this.control && this.control.kind === 'clarify'
        y += ui.composer(L.COMPOSER, y, answering ? 'Answer…' : 'iMessage', () => ask('text', (t) => this.send(t)), () => ask('voice', (t) => this.send(t)))
      } else {
        note('Typing and dictation need Zepp OS 4. Set replies in the Zepp app.', COLOR.tertiary)
      }
      const composerBottom = y

      // New conversation link.
      y += L.PILL.gap
      ui.text({ x: L.NOTE.x, y, w: L.NOTE.w, h: L.LINK.h, text_size: L.LINK.size, color: COLOR.blue, align_h: align.CENTER_H, align_v: align.CENTER_V }, 'New Conversation')
      ui.tap({ x: L.NOTE.x, y, w: L.NOTE.w, h: L.LINK.h }, () => this.newConversation(), { haptic: 'tick' })
      y += L.LINK.h

      // Spacer so the page can scroll the last row clear of the screen edge.
      ui.text({ x: 0, y, w: 1, h: L.BOTTOM_PAD }, '')

      // Jump to the bottom so the composer is in view, but never scroll the newest message
      // above FOCUS_Y: on small and round screens the message matters more than the field.
      const target = Math.min(composerBottom + L.SCROLL_MARGIN - this.screenH, focus - L.FOCUS_Y)
      scrollTo({ y: target > 0 ? -target : 0 })
    }
  })
)
