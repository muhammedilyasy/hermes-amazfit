// Chat on square screens (design 390 x 450). Content flows top-down from TOP; the page
// scrolls when a reply is long.
import { px } from '@zos/utils'
import { COLOR, SIZE } from '../../utils/theme'
import { TYPE, PRIMARY, DANGER } from '../shared.s.layout'

export { HEADER, LABEL, PRIMARY, SECONDARY, DANGER, BOTTOM_PAD, HIDE_STATUS_BAR } from '../shared.s.layout'

const W = 390

export const TOP = px(SIZE.top)
export const TEXT_X = px(SIZE.side)
export const TEXT_W = px(W - SIZE.side * 2)
export const GAP = px(14)
export const BUTTON_GAP = px(SIZE.gap)

export const PROMPT = { size: px(TYPE.caption), color: COLOR.muted, rows: 4 }
export const REPLY = { size: px(TYPE.body), color: COLOR.text }
export const NOTE = { size: px(TYPE.caption), color: COLOR.muted }
export const ERROR = { size: px(TYPE.body), color: COLOR.red }

// Status line while Hermes works (updated every second).
export const STATUS = { h: px(40), size: px(TYPE.body), color: COLOR.text }

// Stop sits at the bottom while Hermes works (content is short then).
export const STOP = Object.assign({}, DANGER, { y: px(366) })

// Bordered card around a command that needs approval, or a question.
export const CONTROL = {
  x: px(SIZE.edge), w: px(W - SIZE.edge * 2), pad: px(18), radius: px(SIZE.radius),
  color: COLOR.card, border: COLOR.border, line_width: px(SIZE.hairline),
  size: px(TYPE.body), textColor: COLOR.text, rows: 8
}

// Deny | Approve, side by side.
const half = (W - SIZE.edge * 2 - SIZE.gap) / 2
export const DENY = Object.assign({}, DANGER, { w: px(half), h: px(SIZE.button) })
export const APPROVE = Object.assign({}, PRIMARY, { x: px(SIZE.edge + half + SIZE.gap), w: px(half) })
