// Home on square screens (design 390 x 450).
import { text_style } from '@zos/ui'
import { px } from '@zos/utils'
import { COLOR, TYPE, SIZE } from '../../utils/theme'
import { PRIMARY, SECONDARY, CELL } from '../shared.s.layout'

export { HEADER, LABEL, BOTTOM_PAD } from '../shared.s.layout'

const W = 390

// Server host when online, the problem otherwise. One line, ellipsis.
export const SUBTITLE = {
  x: px(SIZE.side), y: px(72), w: px(W - SIZE.side * 2), h: px(34),
  text_size: px(TYPE.caption), color: COLOR.faint, text_style: text_style.ELLIPSIS
}

export const ASK = Object.assign({ y: px(114) }, PRIMARY)
export const TYPE_BUTTON = Object.assign({ y: px(194) }, SECONDARY)

export const LIST_TOP = px(270)
export const ROW = Object.assign({ trail: '›' }, CELL)
export const ROW_NEW = Object.assign({}, CELL, { trail: '+', textColor: COLOR.muted })
export const SECTION_GAP = px(10)
