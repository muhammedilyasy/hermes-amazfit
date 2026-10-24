// Hermes design system, after resend.com (dark): true black, near-white text, gray
// cards with hairline borders, white primary buttons, generous 16 px corners. Colors are
// Resend's own tokens (gray-2/4/9/11/12, Radix green/red/amber 11).
// The pixel font (Silkscreen, OFL) is only for the wordmark and small section labels,
// matching the pixel logo; everything else uses the system font.
// Sizes are design px for the square 390 x 450 screen; layout files wrap them in px().

export const COLOR = {
  bg: 0x000000,
  card: 0x191b1e, // gray-2, elevated surface
  border: 0x293034, // gray-4, hairline
  text: 0xf0f0f0, // gray-12
  muted: 0xa1a4a5, // gray-11
  faint: 0x6e7679, // gray-9
  primary: 0xfdfdfd, // white button
  onPrimary: 0x000000,
  green: 0x3dd68c,
  red: 0xff9592,
  amber: 0xffca16
}

// Pressed state: light fills darken a little, dark fills lighten a little, others darken 28.6%.
export function pressed(color) {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  if (Math.max(r, g, b) < 0x40) {
    const up = (v) => Math.min(255, v + 0x12)
    return (up(r) << 16) | (up(g) << 8) | up(b)
  }
  const k = Math.min(r, g, b) > 0xc0 ? 0.86 : 0.714
  return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k)
}

// Resource path, relative to assets/default.s.
export const FONT = { pixel: 'fonts/pixel.ttf' }

export const TYPE = { wordmark: 26, label: 16, button: 28, body: 28, caption: 24 }

export const SIZE = {
  top: 80, // content starts below our header (the system status bar is hidden)
  edge: 16, // card margin
  side: 24, // text margin
  radius: 16, // Resend rounded-2xl
  hairline: 2,
  button: 72,
  secondary: 60,
  row: 68,
  gap: 8,
  logo: 44,
  bottomPad: 110 // keeps the last item clear of the 86 px screen corners
}
