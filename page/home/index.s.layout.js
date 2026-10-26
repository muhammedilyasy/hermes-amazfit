// Conversation on square screens (design 390 x 450; 320 and 432 wide watches scale from it).
// The system status bar is hidden: our header shows avatar, name, status and the time,
// like Messages on Apple Watch. Screen corners have an 86 px radius.
import { align, text_style } from '@zos/ui'
import { px } from '@zos/utils'
import { COLOR, TYPE as SIZES } from '../../utils/theme'

const T = SIZES.square
export const HIDE_STATUS_BAR = true

export const HEADER = {
  center: false,
  avatar: { x: px(20), y: px(16), w: px(44), h: px(44), src: 'avatar.png' },
  name: { x: px(74), y: px(12), w: px(176), h: px(32), text_size: px(T.name), color: COLOR.text, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS },
  sub: { x: px(74), y: px(42), w: px(176), h: px(24), text_size: px(T.small), color: COLOR.secondary, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS },
  time: { x: px(240), y: px(14), w: px(122), h: px(36), text_size: px(T.time), color: COLOR.text, align_h: align.RIGHT, align_v: align.CENTER_V, text_style: text_style.NONE }
}

export const TOP = px(80)

export const BUBBLE = {
  left: px(16), right: px(374), maxW: px(290), padX: px(16), padY: px(9), radius: px(20),
  size: px(T.body), gapSame: px(5), gapOther: px(14),
  tailW: px(14), tailH: px(18), tailOut: px(6)
}

export const STAMP = { x: px(40), w: px(310), h: px(34), size: px(T.small), color: COLOR.secondary }
export const META = { h: px(26), size: px(T.small - 1) }
export const NOTE = { x: px(40), w: px(310), size: px(T.small) }
export const TYPING = { w: px(82), h: px(46), dot: px(6), dotGap: px(18) }

export const PILL = { x: px(16), w: px(358), h: px(56), radius: px(28), size: px(T.pill), gap: px(8) }
export const HALF_GAP = px(8)

export const COMPOSER = { x: px(16), h: px(58), fieldW: px(288), micW: px(58), gap: px(12), padX: px(22), size: px(T.pill), border: px(2) }
export const LINK = { h: px(52), size: px(T.small) }

export const BOTTOM_PAD = px(100)
// How far below the composer to keep visible when scrolling to the newest message.
// The newest message's top stays at least this far from the top of the screen.
export const FOCUS_Y = px(16)
export const SCROLL_MARGIN = px(24)
