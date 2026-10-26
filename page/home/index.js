// The conversation, like Messages on Apple Watch: blue bubbles for you, gray for the agent,
// a typing indicator while it works, Allow / Deny for commands it wants to run, smart
// replies (your quick commands), and an "iMessage" field + mic at the bottom.
//
// Layers: the thread scrolls in a VIEW_CONTAINER (z 0); the header is a fixed VIEW_CONTAINER
// on top (z 1) with a fade at its bottom edge, so messages slide under it.
//
// One run at a time. The side service starts it and returns at once; we poll every 2 s,
// so long agent turns never hit the BLE request timeout. Thread and the run in progress
// are kept in LocalStorage, so reopening the app resumes where it left off.
// Watches without the system keyboard (API < 4.0) get smart replies only.
import { prop, align, text_style } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { setPageBrightTime, pauseDropWristScreenOff, resetDropWristScreenOff } from '@zos/display'
import { showToast } from '@zos/interaction'
import { BasePage } from '@zeppos/zml/base-page'
import * as L from 'zosLoader:./index.[pf].layout.js'
import { Group, layer, removeLayer, hideStatusBar, textHeight } from '../../components/ui'
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
const CONNECT_RETRY_MS = 2500 // the phone link may not be up yet when the app opens
const CONNECT_TRIES = 6

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
      const info = getDeviceInfo()
      this.screenW = info.width
      this.screenH = info.height

      this.thread = load(KEY.thread, [])
      this.run = load(KEY.run, null)
      this.name = (load(KEY.agent, null) || AGENT).name || AGENT.name
      this.commands = []
      this.control = null
      this.answered = ''
      this.slow = false
      this.pollFails = 0
      this.conn = { text: 'Connecting…', color: COLOR.secondary }
      this.connectTries = 0

      this.render() // creates the thread layer first, so the header layer is created on top
      const headLayer = layer({ x: 0, y: 0, w: this.screenW, h: L.HEADER.h + L.HEADER.fadeH, z_index: 1, scroll_enable: 0 })
      this.head = new Group(headLayer).header(L.HEADER, this.screenW)
      this.head.setName(this.name)
      this.head.setTime(now())
      this.updateSub()

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
      clearTimeout(this.connectTimer)
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
      clearTimeout(this.connectTimer)
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
        .catch(() => {
          // Usually just the Bluetooth link still starting: keep trying for a while.
          if (++this.connectTries < CONNECT_TRIES) {
            this.connectTimer = setTimeout(() => this.connect(), CONNECT_RETRY_MS)
          } else {
            this.setConn('Phone not connected', COLOR.red)
          }
        })
        .then(() => this.render())
    },

    // Any successful call proves the phone is there: refresh a stale "not connected".
    reconnectIfStale() {
      if (this.conn.text === 'Phone not connected' || this.conn.text === 'Connecting…') {
        this.connectTries = 0
        this.connect()
      }
    },

    setConn(text, color) {
      this.conn = { text, color }
      this.updateSub()
    },

    // The status line: header on square, first line of the thread on round.
    status() {
      if (this.run && !this.control) return { text: 'typing…', color: COLOR.secondary }
      return this.conn
    },

    updateSub() {
      const st = this.status()
      if (this.head) this.head.setSub(st.text, st.color)
      if (this.statusW) this.statusW.setProperty(prop.MORE, { text: st.text, color: st.color })
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
          this.reconnectIfStale()
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
      const B = L.BUBBLE
      // Rebuild the thread layer from scratch (also resets its scroll position).
      removeLayer(this.thread$)
      this.thread$ = layer({ x: 0, y: 0, w: this.screenW, h: this.screenH, z_index: 0, scroll_enable: 1 })
      const ui = new Group(this.thread$)
      this.typingUI = null
      this.elapsedW = null
      this.statusW = null

      let y = L.TOP
      let prev = null // previous bubble sender, for spacing and tails
      let focus = 0 // top of the newest message: never scroll past it (0 keeps the top in view)
      const center = (text, size, color, h) => {
        ui.text({ x: L.NOTE.x, y, w: L.NOTE.w, h, text_size: size, color, align_h: align.CENTER_H, align_v: align.CENTER_V }, text)
        y += h
      }
      const note = (text, color) => {
        const h = textHeight(text, L.NOTE.size, L.NOTE.w)
        ui.text({ x: L.NOTE.x, y, w: L.NOTE.w, h, text_size: L.NOTE.size, color, align_h: align.CENTER_H }, text)
        y += h + B.gapOther
        prev = null
      }
      const space = (from) => {
        if (prev) y += prev === from ? B.gapSame : B.gapOther
      }

      // Round screens: the status line is the first line of the thread.
      if (L.STATUS_IN_THREAD) {
        const st = this.status()
        this.statusW = ui.text({ x: L.NOTE.x, y, w: L.NOTE.w, h: L.STATUS_LINE.h, text_size: L.NOTE.size, color: st.color, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS }, st.text)
        y += L.STATUS_LINE.h
      }

      const items = this.thread
      if (!items.length && !this.run) {
        // A new conversation: the contact, centered, like the top of a new chat. The big
        // avatar only if it fits above the smart replies and the field without scrolling.
        const I = L.INTRO
        const below = Math.min(this.commands.length, L.FRESH_REPLIES) * (L.PILL.h + L.PILL.gap) + (canType ? L.COMPOSER.h : 0) + L.BOTTOM_GAP + L.PILL.gap * 2
        const full = I.gap + I.avatar + I.gap + I.nameH + I.subH
        y += I.gap
        if (y + full + below <= this.screenH) {
          ui.image({ x: Math.round((this.screenW - I.avatar) / 2), y, w: I.avatar, h: I.avatar, src: 'avatar-large.png' })
          y += I.avatar + I.gap
          center(this.name, I.nameSize, COLOR.text, I.nameH)
        }
        focus = y // may scroll up to here, so the field below stays in the wide part of the screen
        center(canType ? 'Send a message to start' : 'Tap a reply to start', I.subSize, COLOR.secondary, I.subH)
      } else if (items.length) {
        center('New Conversation', L.LINK.size, COLOR.blue, L.LINK.h)
        ui.tap({ x: L.NOTE.x, y: y - L.LINK.h, w: L.NOTE.w, h: L.LINK.h }, () => this.newConversation(), { haptic: 'tick' })
      }

      items.forEach((m, i) => {
        focus = y
        const before = items[i - 1]
        if (!before || m.at - before.at > STAMP_GAP_MS) {
          if (before) y += B.gapOther
          center(stampLabel(m), L.STAMP.size, L.STAMP.color, L.STAMP.h)
          prev = null
        }
        if (m.from === 'note') {
          if (prev) y += B.gapOther
          return note(m.text, m.tone === 'red' ? COLOR.red : COLOR.secondary)
        }
        const mine = m.from === 'me'
        space(m.from)
        const next = items[i + 1]
        const last = !next || next.from !== m.from || next.at - m.at > STAMP_GAP_MS
        const box = ui.bubble(B, { y, text: m.text, mine, tail: last || m.state === 'failed' })
        y += box.h
        prev = m.from

        const isLastMine = mine && !items.slice(i + 1).some((x) => x.from !== 'note')
        if (mine && m.state === 'failed') {
          ui.text({ x: B.left, y, w: B.right - B.left, h: L.META.h, text_size: L.META.size, color: COLOR.red, align_h: align.RIGHT, align_v: align.CENTER_V }, 'Not Delivered · Tap to retry')
          ui.tap({ x: box.x, y: box.y, w: box.w, h: box.h + L.META.h }, () => this.retry(m.id))
          y += L.META.h
          prev = null
        } else if (isLastMine && (m.state === 'sent' || m.state === 'sending')) {
          ui.text({ x: B.left, y, w: B.right - B.left, h: L.META.h, text_size: L.META.size, color: COLOR.secondary, align_h: align.RIGHT, align_v: align.CENTER_V }, m.state === 'sent' ? 'Delivered' : 'Sending…')
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

      // Bottom: the message field, pinned to the bottom of the screen when the conversation is
      // short (like Messages), right after the last message when it's long. Smart replies sit
      // above the field in a new conversation and below it once there are messages, so the
      // field always follows the newest message. Watches without a keyboard get replies only.
      const fresh = !items.length && !this.run
      const replies = this.run ? [] : this.commands.slice(0, fresh && canType ? L.FRESH_REPLIES : MAX_SMART_REPLIES)
      const pillRow = L.PILL.h + L.PILL.gap
      const drawReplies = () =>
        replies.forEach((cmd) => {
          ui.pill(Object.assign({}, L.PILL, { y, color: COLOR.pill, textColor: COLOR.text }), cmd, () => this.send(cmd))
          y += pillRow
        })
      let anchor // bottom of what must be visible after scrolling (field, or last reply)
      if (canType) {
        const before = fresh ? replies.length * pillRow : 0
        y = Math.max(y + L.PILL.gap * 2, this.screenH - L.BOTTOM_GAP - L.COMPOSER.h - before)
        if (fresh) drawReplies()
        const answering = this.control && this.control.kind === 'clarify'
        y += ui.composer(L.COMPOSER, y, answering ? 'Answer…' : 'iMessage', () => ask('text', (t) => this.send(t)), () => ask('voice', (t) => this.send(t)))
        anchor = y
        if (!fresh && replies.length) {
          y += L.PILL.gap * 2
          drawReplies()
        }
      } else {
        const hint = 'Typing and dictation need Zepp OS 4. Set replies in the Zepp app.'
        const hintH = textHeight(hint, L.NOTE.size, L.NOTE.w)
        y = Math.max(y + L.PILL.gap * 2, this.screenH - L.BOTTOM_GAP - replies.length * pillRow - hintH)
        drawReplies()
        ui.text({ x: L.NOTE.x, y, w: L.NOTE.w, h: hintH, text_size: L.NOTE.size, color: COLOR.tertiary, align_h: align.CENTER_H }, hint)
        y += hintH
        anchor = y
      }
      const end = y + L.BOTTOM_GAP
      // Make the layer's content reach `end`, so it can scroll everything into place.
      ui.text({ x: 0, y: end - 1, w: 1, h: 1 }, '')

      // Show the bottom of the conversation, but never scroll the newest message under the header.
      const target = Math.min(anchor + L.BOTTOM_GAP - this.screenH, focus - L.FOCUS_Y)
      if (target > 0) this.thread$.setProperty(prop.MORE, { pos_y: -target })
    }
  })
)
