// Shared round-screen styles (design 480 x 480; 466, 454, 416 and 360 px watches scale from it).
// The whole circle is drawable and there is no status bar: the header (logo + wordmark) is
// centered at the top, with the status line centered under it. Content is kept inside the
// circle: at height y the usable half-width is sqrt(240^2 - (240 - y)^2).
import { align, text_style } from '@zos/ui'
import { px } from '@zos/utils'
import { COLOR, TYPE as SIZES, SIZE, FONT } from '../utils/theme'

const W = 480
export const TYPE = SIZES.round
export const HIDE_STATUS_BAR = false

const LOGO = 48
const WORD_W = 160
const ROW_X = (W - (LOGO + 14 + WORD_W)) / 2 // logo + gap + wordmark, centered

export const HEADER = {
  center: true,
  dotGap: px(10),
  logo: { x: px(ROW_X), y: px(30), w: px(LOGO), h: px(LOGO), src: 'logo.png' },
  wordmark: {
    x: px(ROW_X + LOGO + 14), y: px(30), w: px(WORD_W), h: px(LOGO),
    text_size: px(TYPE.wordmark), color: COLOR.text, font: FONT.pixel,
    align_v: align.CENTER_V, text_style: text_style.NONE
  },
  dot: { center_x: px(W / 2), center_y: px(104), radius: px(7) },
  status: {
    x: px(80), y: px(84), w: px(W - 160), h: px(40),
    text_size: px(TYPE.caption), color: COLOR.muted,
    align_v: align.CENTER_V, text_style: text_style.NONE
  }
}

export const LABEL = {
  x: px(64), w: px(W - 128), h: px(34),
  text_size: px(TYPE.label), color: COLOR.faint, font: FONT.pixel,
  align_v: align.CENTER_V, text_style: text_style.NONE
}

const button = (h) => ({ x: px(48), w: px(W - 96), h: px(h), radius: px(SIZE.radius + 4), text_size: px(TYPE.button) })
export const PRIMARY = Object.assign(button(80), { color: COLOR.primary, textColor: COLOR.onPrimary })
export const SECONDARY = Object.assign(button(66), { color: COLOR.card, textColor: COLOR.text })
export const DANGER = Object.assign(button(66), { color: COLOR.card, textColor: COLOR.red })

export const CELL = {
  x: px(48), w: px(W - 96), h: px(76), radius: px(SIZE.radius + 4), padX: px(24),
  color: COLOR.card, border: COLOR.border, line_width: px(SIZE.hairline),
  textColor: COLOR.text, text_size: px(TYPE.body), trailColor: COLOR.faint, trailW: px(30), gap: px(10)
}

// Room to scroll the last item up to the middle of the circle.
export const BOTTOM_PAD = px(170)
