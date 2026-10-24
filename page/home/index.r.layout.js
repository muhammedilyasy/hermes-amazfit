// Home on round screens (design 480 x 480). Everything is centered on the vertical axis.
import { align, text_style } from '@zos/ui'
import { px } from '@zos/utils'
import { COLOR } from '../../utils/theme'
import { TYPE, PRIMARY, SECONDARY, CELL } from '../shared.r.layout'

export { HEADER, LABEL, BOTTOM_PAD, HIDE_STATUS_BAR } from '../shared.r.layout'

const W = 480

// Smaller than the caption size so typical errors fit on one line inside the circle.
export const SUBTITLE = {
  x: px(60), y: px(124), w: px(W - 120), h: px(38),
  text_size: px(TYPE.caption - 4), color: COLOR.faint, align_h: align.CENTER_H, text_style: text_style.ELLIPSIS
}

export const ASK = Object.assign({ y: px(172) }, PRIMARY)
export const TYPE_BUTTON = Object.assign({ y: px(262) }, SECONDARY)

export const LIST_TOP = px(346)
export const LIST_TOP_NO_INPUT = px(176)
export const ROW = Object.assign({ trail: '›' }, CELL)
export const ROW_NEW = Object.assign({}, CELL, { trail: '+', textColor: COLOR.muted })
export const SECTION_GAP = px(12)

export const NOTE = { x: px(72), w: px(W - 144), text_size: px(TYPE.caption), color: COLOR.faint, align_h: align.CENTER_H }
