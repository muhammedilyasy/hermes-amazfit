// Home on square screens (design 390 x 450).
import { align, text_style } from '@zos/ui'
import { px } from '@zos/utils'
import { COLOR, SIZE } from '../../utils/theme'
import { TYPE, PRIMARY, SECONDARY, CELL } from '../shared.s.layout'

export { HEADER, LABEL, BOTTOM_PAD, HIDE_STATUS_BAR } from '../shared.s.layout'

const W = 390

// Server host when online, the problem otherwise. One line, ellipsis.
export const SUBTITLE = {
  x: px(SIZE.side), y: px(72), w: px(W - SIZE.side * 2), h: px(34),
  text_size: px(TYPE.caption), color: COLOR.faint, text_style: text_style.ELLIPSIS
}

export const ASK = Object.assign({ y: px(114) }, PRIMARY)
export const TYPE_BUTTON = Object.assign({ y: px(194) }, SECONDARY)

// The list starts under the buttons, or right under the subtitle on watches without a keyboard.
export const LIST_TOP = px(270)
export const LIST_TOP_NO_INPUT = px(114)
export const ROW = Object.assign({ trail: '›' }, CELL)
export const ROW_NEW = Object.assign({}, CELL, { trail: '+', textColor: COLOR.muted })
export const SECTION_GAP = px(10)

// Footnote under the list (e.g. why voice is missing).
export const NOTE = { x: px(SIZE.side), w: px(W - SIZE.side * 2), text_size: px(TYPE.caption), color: COLOR.faint, align_h: align.LEFT }
