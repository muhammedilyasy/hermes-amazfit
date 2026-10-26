// Conversation on round screens (design 480 x 480; 466, 454, 416 and 360 px watches scale
// from it). A fixed header (clock, avatar + name) sits on top of the scrolling thread with a
// fade at its bottom edge. The status line lives at the top of the thread. Content stays
// inside the circle: at height y the usable half-width is sqrt(240^2 - (240 - y)^2).
import { align, text_style } from '@zos/ui'
import { px } from '@zos/utils'
import { COLOR, TYPE as SIZES } from '../../utils/theme'

const T = SIZES.round
export const HIDE_STATUS_BAR = false

export const HEADER = {
  center: true, // avatar + name centered as a row; widths measured at runtime
  gap: px(12),
  h: px(100),
  fadeH: px(28),
  avatar: { x: px(0), y: px(50), w: px(44), h: px(44), src: 'avatar.png' },
  name: { x: px(0), y: px(50), w: px(260), h: px(44), text_size: px(T.name), color: COLOR.text, align_v: align.CENTER_V, text_style: text_style.NONE },
  sub: null,
  time: { x: px(140), y: px(10), w: px(200), h: px(38), text_size: px(T.time), color: COLOR.text, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.NONE }
}
// Round has no room for the status in the header: it is the first line of the thread.
export const STATUS_IN_THREAD = true

export const TOP = px(108)

export const BUBBLE = {
  left: px(44), right: px(436), maxW: px(320), padX: px(18), padY: px(10), radius: px(24),
  size: px(T.body), gapSame: px(6), gapOther: px(16),
  tailW: px(31), tailH: px(24), tailOut: px(7)
}

export const STAMP = { x: px(90), w: px(300), h: px(40), size: px(T.small), color: COLOR.secondary }
export const META = { h: px(30), size: px(T.small - 1) }
export const NOTE = { x: px(80), w: px(320), size: px(T.small) }
export const STATUS_LINE = { h: px(34) }
export const TYPING = { w: px(98), h: px(54), dot: px(7), dotGap: px(22) }

export const INTRO = { avatar: px(60), gap: px(8), nameSize: px(T.name + 4), nameH: px(44), subSize: px(T.small), subH: px(32) }

export const PILL = { x: px(64), w: px(352), h: px(64), radius: px(32), size: px(T.pill), gap: px(10) }
export const HALF_GAP = px(10)
// Smart replies above the field in a new conversation (the circle has room for two).
export const FRESH_REPLIES = 2

export const COMPOSER = { x: px(64), h: px(66), fieldW: px(270), micW: px(66), gap: px(16), padX: px(26), size: px(T.pill), border: px(2) }
export const LINK = { h: px(50), size: px(T.small) }

// The field + mic is 352 wide: it must sit where the circle is at least that wide.
export const BOTTOM_GAP = px(78)
export const FOCUS_Y = px(116)
