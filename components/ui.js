// Building blocks for the Messages-style UI. Positions and sizes come from the page's
// *.s.layout.js / *.r.layout.js file. Every widget is created through a Group, either on the
// page or inside a VIEW_CONTAINER layer (the scrolling thread, the fixed header).
import { createWidget, deleteWidget, widget, align, text_style, prop, event, getTextLayout, setStatusBarVisible } from '@zos/ui'
import { COLOR, pressed } from '../utils/theme'
import { tick, confirm } from '../utils/haptics'

// Width of one line of system-font text. getTextLayout can't measure custom fonts.
export function textWidth(value, size) {
  return getTextLayout(value || ' ', { text_size: size, text_width: 0, wrapped: 0 }).width
}

// Height of wrapped system-font text in a box of width w.
export function textHeight(value, size, w) {
  return getTextLayout(value || ' ', { text_size: size, text_width: w, wrapped: 1 }).height
}

// Round screens have no status bar API, so layouts gate this with HIDE_STATUS_BAR.
export function hideStatusBar(hide) {
  if (hide) setStatusBarVisible(false)
}

// A VIEW_CONTAINER layer. modal: 0 so a layer on top doesn't block scrolling underneath.
export function layer(options) {
  return createWidget(widget.VIEW_CONTAINER, Object.assign({ modal: 0 }, options))
}

export function removeLayer(container) {
  if (container) deleteWidget(container)
}

export class Group {
  // parent: a VIEW_CONTAINER to create the widgets in (its coordinates), or none for the page.
  constructor(parent) {
    this.parent = parent || null
    this.items = []
  }

  add(type, options) {
    const w = this.parent ? this.parent.createWidget(type, options) : createWidget(type, options)
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

  // Images scale to their box, so one asset per shape works on every screen size.
  image(style) {
    return this.add(widget.IMG, Object.assign({ auto_scale: true }, style))
  }

  circle(style) {
    return this.add(widget.CIRCLE, style)
  }

  // Invisible tap area over a box. Create it LAST, or the widgets under it swallow taps.
  // onDown/onUp give pressed feedback to the shape underneath.
  tap(box, onTap, feedback = {}) {
    const hit = this.text({ x: box.x, y: box.y, w: box.w, h: box.h }, '')
    hit.addEventListener(event.CLICK_DOWN, () => feedback.down && feedback.down())
    hit.addEventListener(event.MOVE_OUT, () => feedback.up && feedback.up())
    hit.addEventListener(event.CLICK_UP, () => {
      feedback.up && feedback.up()
      ;(feedback.haptic === 'tick' ? tick : confirm)()
      onTap && onTap()
    })
    return hit
  }

  // Capsule button (smart replies, Allow / Deny, Stop). style: { x, y, w, h, radius, size,
  // color, textColor }
  pill(style, label, onTap, haptic) {
    const { color, textColor, size, ...box } = style
    return this.add(widget.BUTTON, Object.assign({}, box, {
      text: label,
      text_size: size,
      color: textColor,
      normal_color: color,
      press_color: pressed(color),
      click_func: () => {
        ;(haptic === 'tick' ? tick : confirm)()
        onTap && onTap()
      }
    }))
  }

  // Message bubble with an iMessage tail. spec: { y, text, mine, tail, color } + layout B.
  // Returns { x, y, w, h } of the bubble.
  bubble(B, spec) {
    const inner = B.maxW - B.padX * 2
    const oneLine = textWidth(spec.text, B.size)
    let w, textW, textH
    if (oneLine <= inner) {
      textW = oneLine + 4 // slack so the last glyph is never clipped
      textH = Math.ceil(B.size * 1.2)
      w = textW + B.padX * 2
    } else {
      textW = inner
      textH = textHeight(spec.text, B.size, inner)
      w = B.maxW
    }
    const h = textH + B.padY * 2
    const x = spec.mine ? B.right - w : B.left
    const y = spec.y
    const color = spec.color !== undefined ? spec.color : spec.mine ? COLOR.outgoing : COLOR.incoming
    if (spec.tail) {
      this.image({
        x: spec.mine ? x + w + B.tailOut - B.tailW : x - B.tailOut,
        y: y + h - B.tailH,
        w: B.tailW, h: B.tailH,
        src: spec.mine ? 'tail-out.png' : 'tail-in.png'
      })
    }
    this.rect({ x, y, w, h, radius: B.radius, color })
    this.text({ x: x + B.padX, y: y + B.padY, w: textW, h: textH, text_size: B.size, color: COLOR.text }, spec.text)
    return { x, y, w, h }
  }

  // Gray bubble with three dots. Returns animate(step) to light one dot at a time.
  typing(B, T, y) {
    const x = B.left
    this.image({ x: x - B.tailOut, y: y + T.h - B.tailH, w: B.tailW, h: B.tailH, src: 'tail-in.png' })
    this.rect({ x, y, w: T.w, h: T.h, radius: T.h / 2, color: COLOR.incoming })
    const cx = x + T.w / 2
    const dots = [-1, 0, 1].map((i) =>
      this.circle({ center_x: Math.round(cx + i * T.dotGap), center_y: y + T.h / 2, radius: T.dot, color: COLOR.dot })
    )
    return {
      h: T.h,
      animate(step) {
        dots.forEach((d, i) => d.setProperty(prop.MORE, { color: i === step % 3 ? COLOR.dotHi : COLOR.dot }))
      }
    }
  }

  // "iMessage" field + blue mic button. C: COMPOSER layout. Returns its height.
  composer(C, y, placeholder, onText, onVoice) {
    const field = { x: C.x, y, w: C.fieldW, h: C.h }
    const bg = this.rect(Object.assign({ radius: C.h / 2, color: COLOR.field }, field))
    this.add(widget.STROKE_RECT, Object.assign({ radius: C.h / 2, color: COLOR.fieldBorder, line_width: C.border }, field))
    this.text({ x: C.x + C.padX, y, w: C.fieldW - C.padX * 2, h: C.h, text_size: C.size, color: COLOR.secondary, align_v: align.CENTER_V, text_style: text_style.ELLIPSIS }, placeholder)
    const micX = C.x + C.fieldW + C.gap
    const r = C.micW / 2
    const mic = this.circle({ center_x: micX + r, center_y: y + C.h / 2, radius: r, color: COLOR.blue })
    const glyph = Math.round(C.micW * 0.52)
    this.image({ x: Math.round(micX + r - glyph / 2), y: Math.round(y + C.h / 2 - glyph / 2), w: glyph, h: glyph, src: 'mic.png' })
    this.tap(field, onText, {
      haptic: 'tick',
      down: () => bg.setProperty(prop.MORE, { color: pressed(COLOR.field) }),
      up: () => bg.setProperty(prop.MORE, { color: COLOR.field })
    })
    this.tap({ x: micX, y, w: C.micW, h: C.h }, onVoice, {
      down: () => mic.setProperty(prop.MORE, { color: pressed(COLOR.blue) }),
      up: () => mic.setProperty(prop.MORE, { color: COLOR.blue })
    })
    return C.h
  }

  // Fixed header: black bar with a fade below it (messages slide under it), avatar, name,
  // optional status line, clock. width: screen width. Returns { setName, setSub, setTime }.
  header(H, width) {
    this.rect({ x: 0, y: 0, w: width, h: H.h, color: COLOR.bg })
    this.image({ x: 0, y: H.h, w: width, h: H.fadeH, src: 'fade.png' })
    const avatar = this.image(Object.assign({}, H.avatar))
    const name = this.text(H.name, '')
    const sub = H.sub ? this.text(H.sub, '') : null
    const time = this.text(H.time, '')
    return {
      setName(value) {
        if (H.center) {
          // Center the avatar + name row; the name box is clamped to the row's max width.
          const nameW = Math.min(H.name.w, textWidth(value, H.name.text_size) + 4)
          const rowW = H.avatar.w + H.gap + nameW
          const x0 = Math.round((H.time.x * 2 + H.time.w - rowW) / 2)
          avatar.setProperty(prop.MORE, Object.assign({}, H.avatar, { x: x0 }))
          name.setProperty(prop.MORE, { x: x0 + H.avatar.w + H.gap, w: nameW, text: value })
        } else {
          name.setProperty(prop.MORE, { text: value })
        }
      },
      setSub(value, color) {
        if (sub) sub.setProperty(prop.MORE, { text: value, color: color || COLOR.secondary })
      },
      setTime(value) {
        time.setProperty(prop.MORE, { text: value })
      }
    }
  }
}
