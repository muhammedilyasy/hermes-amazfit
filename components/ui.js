// Basic building blocks. Positions and sizes come from the page's *.s.layout.js file.
// Every widget is created through a Group so a page can clear and rebuild its content.
import { createWidget, deleteWidget, widget, align, text_style, prop, event, getTextLayout, setStatusBarVisible } from '@zos/ui'
import { pressed } from '../utils/theme'
import { tick, confirm } from '../utils/haptics'

export class Group {
  constructor() {
    this.items = []
  }

  add(type, options) {
    const w = createWidget(type, options)
    this.items.push(w)
    return w
  }

  clear() {
    this.items.forEach((w) => deleteWidget(w))
    this.items = []
  }

  text(style, value) {
    return this.add(
      widget.TEXT,
      Object.assign({ align_h: align.LEFT, align_v: align.TOP, text_style: text_style.WRAP }, style, { text: value })
    )
  }

  rect(style) {
    return this.add(widget.FILL_RECT, style)
  }

  image(style) {
    return this.add(widget.IMG, style)
  }

  // Filled card with a hairline border. style: { x, y, w, h, radius, color, border, line_width }
  card(style) {
    const { border, line_width, ...box } = style
    const bg = this.rect(box)
    this.add(widget.STROKE_RECT, { x: box.x, y: box.y, w: box.w, h: box.h, radius: box.radius, color: border, line_width })
    return bg
  }

  // Button. style: { x, y, w, h, radius, color (bg), textColor, text_size }
  button(style, label, onClick, haptic) {
    const { color, textColor, ...box } = style
    return this.add(
      widget.BUTTON,
      Object.assign({}, box, {
        text: label,
        color: textColor,
        normal_color: color,
        press_color: pressed(color),
        click_func: () => {
          haptic === 'tick' ? tick() : confirm()
          onClick && onClick()
        }
      })
    )
  }

  // Bordered card row: label on the left, a muted trailing glyph (arrow / plus) on the right.
  // style: { x, y, w, h, radius, padX, color, border, line_width, textColor, text_size,
  //          trail, trailColor, trailW }
  cell(style, label, onTap) {
    const { x, y, w, h, radius, padX, color, border, line_width, textColor, text_size, trail, trailColor, trailW } = style
    const bg = this.card({ x, y, w, h, radius, color, border, line_width })
    this.text(
      { x: x + padX, y, w: w - padX * 2 - trailW, h, color: textColor, text_size, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS },
      label
    )
    if (trail) {
      this.text({ x: x + w - padX - trailW, y, w: trailW, h, color: trailColor, text_size, align_h: align.RIGHT, align_v: align.CENTER_V, text_style: text_style.NONE }, trail)
    }
    // Tap area last, or the labels would swallow the taps. Only the box: radius means
    // something else on a TEXT widget.
    const hit = this.text({ x, y, w, h }, '')
    hit.addEventListener(event.CLICK_DOWN, () => bg.setProperty(prop.MORE, { color: pressed(color) }))
    hit.addEventListener(event.MOVE_OUT, () => bg.setProperty(prop.MORE, { color }))
    hit.addEventListener(event.CLICK_UP, () => {
      bg.setProperty(prop.MORE, { color })
      confirm()
      onTap && onTap()
    })
    return hit
  }

  // Logo tile + pixel wordmark, and a status dot + label.
  // style: { logo, wordmark, dot, status, center }. With center (round screens) the dot +
  // label pair is centered in the status box; otherwise the dot sits at dot.center_x.
  // Returns { setStatus(text, color) }.
  header(style, title) {
    this.image(style.logo)
    this.text(style.wordmark, title)
    const dot = this.add(widget.CIRCLE, Object.assign({}, style.dot, { color: style.status.color, alpha: 0 }))
    const label = this.text(Object.assign({}, style.status, style.center ? { align_h: align.LEFT } : {}), '')
    return {
      setStatus(text, color) {
        const d = Object.assign({}, style.dot)
        const box = { text, color }
        if (style.center && text) {
          const s = style.status
          const r = style.dot.radius
          const textW = getTextLayout(text, { text_size: s.text_size, text_width: 0, wrapped: 0 }).width
          const startX = s.x + Math.floor((s.w - (r * 2 + style.dotGap + textW)) / 2)
          d.center_x = startX + r
          Object.assign(box, { x: startX + r * 2 + style.dotGap, w: textW + style.dotGap })
        }
        dot.setProperty(prop.MORE, Object.assign(d, { color, alpha: text ? 255 : 0 }))
        label.setProperty(prop.MORE, box)
      }
    }
  }
}

// Our own header replaces the system status bar. Square screens only: round screens have
// no status bar API, so layouts gate this with HIDE_STATUS_BAR.
export function hideStatusBar(hide) {
  if (hide) setStatusBarVisible(false)
}

// Height of wrapped text in a box of width w (optionally capped at maxRows).
// System font only: getTextLayout cannot measure custom fonts.
export function textHeight(value, size, w, maxRows) {
  const opts = { text_size: size, text_width: w, wrapped: 1 }
  if (maxRows) opts.rows_max = maxRows
  return getTextLayout(value || ' ', opts).height
}
