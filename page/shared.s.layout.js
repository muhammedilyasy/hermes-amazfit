// Shared square-screen styles (design 390 x 450). The system status bar is hidden; our
// header (logo tile, pixel wordmark, status) takes its place. Screen corners: 86 px radius.
import { align, text_style } from '@zos/ui'
import { px } from '@zos/utils'
import { COLOR, TYPE, SIZE, FONT } from '../utils/theme'

const W = 390

export const HEADER = {
  logo: { x: px(32), y: px(20), w: px(SIZE.logo), h: px(SIZE.logo), src: 'logo.png' },
  wordmark: {
    x: px(88), y: px(20), w: px(140), h: px(SIZE.logo),
    text_size: px(TYPE.wordmark), color: COLOR.text, font: FONT.pixel,
    align_v: align.CENTER_V, text_style: text_style.NONE
  },
  dot: { center_x: px(240), center_y: px(42), radius: px(6) },
  status: {
    x: px(252), y: px(20), w: px(W - 252 - 30), h: px(SIZE.logo),
    text_size: px(TYPE.caption), color: COLOR.muted,
    align_v: align.CENTER_V, text_style: text_style.ELLIPSIS
  }
}

// Small uppercase section label in the pixel font (Resend-style eyebrow).
export const LABEL = {
  x: px(SIZE.side), w: px(W - SIZE.side * 2), h: px(30),
  text_size: px(TYPE.label), color: COLOR.faint, font: FONT.pixel,
  align_v: align.CENTER_V, text_style: text_style.NONE
}

const button = (h) => ({ x: px(SIZE.edge), w: px(W - SIZE.edge * 2), h: px(h), radius: px(SIZE.radius), text_size: px(TYPE.button) })
export const PRIMARY = Object.assign(button(SIZE.button), { color: COLOR.primary, textColor: COLOR.onPrimary })
export const SECONDARY = Object.assign(button(SIZE.secondary), { color: COLOR.card, textColor: COLOR.text })
export const DANGER = Object.assign(button(SIZE.secondary), { color: COLOR.card, textColor: COLOR.red })

export const CELL = {
  x: px(SIZE.edge), w: px(W - SIZE.edge * 2), h: px(SIZE.row), radius: px(SIZE.radius), padX: px(20),
  color: COLOR.card, border: COLOR.border, line_width: px(SIZE.hairline),
  textColor: COLOR.text, text_size: px(TYPE.body), trailColor: COLOR.faint, trailW: px(28), gap: px(SIZE.gap)
}

export const BOTTOM_PAD = px(SIZE.bottomPad)
