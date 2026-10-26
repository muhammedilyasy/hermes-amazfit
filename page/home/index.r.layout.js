// Conversation on round screens (design 480 x 480; 466, 454, 416 and 360 px watches scale
// from it). No status bar on round: the time sits at the top center, avatar + name under it.
// Content stays inside the circle: at height y the usable half-width is sqrt(240^2 - (240 - y)^2).
import { align, text_style } from '@zos/ui'
import { px } from '@zos/utils'
import { COLOR, TYPE as SIZES } from '../../utils/theme'

const T = SIZES.round
export const HIDE_STATUS_BAR = false

export const HEADER = {
  center: true, // avatar + name centered as a row; widths measured at runtime
  gap: px(12),
  avatar: { x: px(0), y: px(54), w: px(52), h: px(52), src: 'avatar.png' },
  name: { x: px(0), y: px(58), w: px(260), h: px(44), text_size: px(T.name), color: COLOR.text, align_v: align.CENTER_V, text_style: text_style.NONE },
  sub: { x: px(90), y: px(108), w: px(300), h: px(30), text_size: px(T.small), color: COLOR.secondary, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS },
  time: { x: px(140), y: px(12), w: px(200), h: px(38), text_size: px(T.time), color: COLOR.text, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.NONE }
}

export const TOP = px(150)

export const BUBBLE = {
  left: px(44), right: px(436), maxW: px(320), padX: px(18), padY: px(10), radius: px(24),
  size: px(T.body), gapSame: px(6), gapOther: px(16),
  tailW: px(17), tailH: px(22), tailOut: px(7)
}

export const STAMP = { x: px(90), w: px(300), h: px(40), size: px(T.small), color: COLOR.secondary }
export const META = { h: px(30), size: px(T.small - 1) }
export const NOTE = { x: px(80), w: px(320), size: px(T.small) }
export const TYPING = { w: px(98), h: px(54), dot: px(7), dotGap: px(22) }

export const PILL = { x: px(64), w: px(352), h: px(64), radius: px(32), size: px(T.pill), gap: px(10) }
export const HALF_GAP = px(10)

export const COMPOSER = { x: px(64), h: px(66), fieldW: px(270), micW: px(66), gap: px(16), padX: px(26), size: px(T.pill), border: px(2) }
export const LINK = { h: px(60), size: px(T.small) }

export const BOTTOM_PAD = px(170)
// Keep the composer in the lower-middle of the circle, not at its narrow bottom edge.
// The newest message's top stays at least this far from the top of the screen.
export const FOCUS_Y = px(64)
export const SCROLL_MARGIN = px(110)
