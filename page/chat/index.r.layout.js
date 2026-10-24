// Chat on round screens (design 480 x 480). Content flows top-down from TOP inside the
// circle; the page scrolls when a reply is long.
import { px } from '@zos/utils'
import { COLOR, SIZE } from '../../utils/theme'
import { TYPE, PRIMARY, DANGER } from '../shared.r.layout'

export { HEADER, LABEL, PRIMARY, SECONDARY, DANGER, BOTTOM_PAD, HIDE_STATUS_BAR } from '../shared.r.layout'

const W = 480
const EDGE = 48

export const TOP = px(136)
export const TEXT_X = px(72)
export const TEXT_W = px(W - 144)
export const GAP = px(16)
export const BUTTON_GAP = px(10)

export const PROMPT = { size: px(TYPE.caption), color: COLOR.muted, rows: 4 }
export const REPLY = { size: px(TYPE.body), color: COLOR.text }
export const NOTE = { size: px(TYPE.caption), color: COLOR.muted }
export const ERROR = { size: px(TYPE.body), color: COLOR.red }

export const STATUS = { h: px(46), size: px(TYPE.body), color: COLOR.text }

// Narrower near the bottom of the circle.
export const STOP = Object.assign({}, DANGER, { x: px(96), w: px(W - 192), y: px(362) })

export const CONTROL = {
  x: px(EDGE), w: px(W - EDGE * 2), pad: px(22), radius: px(SIZE.radius + 4),
  color: COLOR.card, border: COLOR.border, line_width: px(SIZE.hairline),
  size: px(TYPE.body), textColor: COLOR.text, rows: 8
}

const half = (W - EDGE * 2 - 10) / 2
export const DENY = Object.assign({}, DANGER, { w: px(half), h: px(80) })
export const APPROVE = Object.assign({}, PRIMARY, { x: px(EDGE + half + 10), w: px(half) })
