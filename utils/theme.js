// Messages design system, after iMessage on Apple Watch: true black, blue outgoing
// bubbles, gray incoming bubbles, gray "smart reply" pills, a blue mic button.
// Colors are Apple's dark-mode system colors.
// Sizes are design px (square 390 wide, round 480 wide); layout files wrap them in px().

export const COLOR = {
  bg: 0x000000,
  text: 0xffffff,
  secondary: 0x8e8e93, // systemGray
  tertiary: 0x636366, // systemGray2
  incoming: 0x262628, // gray bubble
  outgoing: 0x0a84ff, // iMessage blue
  pill: 0x262628, // smart replies, secondary buttons
  field: 0x1c1c1e, // message field
  fieldBorder: 0x3a3a3c,
  dot: 0x8e8e93, // typing dots
  dotHi: 0xd1d1d6,
  blue: 0x0a84ff,
  green: 0x30d158,
  red: 0xff453a,
  orange: 0xff9f0a
}

// Pressed state: light fills darken, dark fills lighten a little.
export function pressed(color) {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  if (Math.max(r, g, b) < 0x40) {
    const up = (v) => Math.min(255, v + 0x18)
    return (up(r) << 16) | (up(g) << 8) | up(b)
  }
  const k = 0.75
  return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k)
}

// Per screen shape (design widths: square 390, round 480).
export const TYPE = {
  square: { name: 26, body: 26, small: 19, time: 28, pill: 24 },
  round: { name: 30, body: 30, small: 22, time: 30, pill: 28 }
}
