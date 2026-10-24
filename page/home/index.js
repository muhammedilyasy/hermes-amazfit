// Home: header with connection status, Ask by voice / Type, quick commands, last reply,
// new conversation.
import { prop } from '@zos/ui'
import { push } from '@zos/router'
import { showToast } from '@zos/interaction'
import { BasePage } from '@zeppos/zml/base-page'
import * as L from 'zosLoader:./index.[pf].layout.js'
import { Group, hideStatusBar } from '../../components/ui'
import { COLOR } from '../../utils/theme'
import { ask, requestId } from '../../utils/input'
import { load, save, KEY } from '../../utils/store'

function openChat(params) {
  push({ url: 'page/chat/index', params: JSON.stringify(params) })
}

function send(input) {
  openChat({ input, requestId: requestId() })
}

function lastLabel(last) {
  if (last.status === 'completed') return last.input
  return (last.error || last.status === 'failed' ? 'Failed: ' : 'Running: ') + last.input
}

Page(
  BasePage({
    state: { commands: [] },

    build() {
      hideStatusBar()
      const ui = new Group()
      this.head = ui.header(L.HEADER, 'HERMES')
      this.head.setStatus('Checking', COLOR.faint)
      this.subtitle = ui.text(L.SUBTITLE, '')
      ui.button(L.ASK, 'Ask by voice', () => ask('voice', send))
      ui.button(L.TYPE_BUTTON, 'Type', () => ask('text', send), 'tick')
      this.list = new Group()
      this.renderList()
      this.connect()
    },

    setStatus(label, color, subtitle, subtitleColor) {
      this.head.setStatus(label, color)
      this.subtitle.setProperty(prop.MORE, { text: subtitle || '', color: subtitleColor || COLOR.faint })
    },

    connect() {
      this.request({ method: 'CONFIG' })
        .then((cfg) => {
          if (cfg.error) throw new Error(cfg.error)
          this.state.commands = cfg.commands || []
          this.renderList()
          if (!cfg.configured) {
            this.setStatus('Set up', COLOR.amber, 'Add server + key in Zepp app', COLOR.amber)
            return
          }
          return this.request({ method: 'HEALTH' }).then((h) => {
            if (h.error) this.setStatus('Offline', COLOR.red, h.error, COLOR.red)
            else this.setStatus('Online', COLOR.green, cfg.host || '')
          })
        })
        .catch(() => this.setStatus('No phone', COLOR.red, 'Open the Zepp app on your phone', COLOR.red))
    },

    renderList() {
      const ui = this.list
      ui.clear()
      let y = L.LIST_TOP
      const label = (text) => {
        ui.text(Object.assign({ y }, L.LABEL), text)
        y += L.LABEL.h + L.SECTION_GAP / 2
      }
      const row = (style, text, onTap) => {
        ui.cell(Object.assign({ y }, style), text, onTap)
        y += style.h + style.gap
      }

      if (this.state.commands.length) {
        label('QUICK COMMANDS')
        this.state.commands.forEach((cmd) => row(L.ROW, cmd, () => send(cmd)))
        y += L.SECTION_GAP
      }

      label('CONVERSATION')
      const last = load(KEY.last, null)
      if (last && last.input) row(L.ROW, lastLabel(last), () => openChat({ resume: true }))
      row(L.ROW_NEW, 'New conversation', () => this.newConversation())

      // Spacer so the page scrolls the last row clear of the rounded corners.
      ui.text({ x: 0, y, w: 1, h: L.BOTTOM_PAD }, '')
    },

    newConversation() {
      this.request({ method: 'NEW_SESSION' })
        .then((r) => {
          if (r.error) throw new Error(r.error)
          save(KEY.last, null)
          this.renderList()
          showToast({ content: 'New conversation' })
        })
        .catch(() => showToast({ content: 'Phone not connected' }))
    }
  })
)
