// Local wall-clock time from the watch (the JS Date may not use the watch's time zone).
import { Time } from '@zos/sensor'
import { getTimeFormat, TIME_FORMAT_24 } from '@zos/settings'

const time = new Time()
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] // getDay(): 1 = Monday

const pad = (n) => (n < 10 ? '0' + n : '' + n)

// "9:41 AM" or "09:41", following the watch's 12/24-hour setting.
export function formatTime(h, m) {
  if (getTimeFormat() === TIME_FORMAT_24) return pad(h) + ':' + pad(m)
  return ((h + 11) % 12) + 1 + ':' + pad(m) + (h < 12 ? ' AM' : ' PM')
}

// Snapshot stored with each message: { at (ms), day: 'YYYY-MM-DD', wd: 'Mon', hm: '9:41 AM' }.
export function stamp() {
  return {
    at: Date.now(),
    day: time.getFullYear() + '-' + pad(time.getMonth()) + '-' + pad(time.getDate()),
    wd: DAYS[(time.getDay() + 6) % 7],
    hm: formatTime(time.getHours(), time.getMinutes())
  }
}

export function now() {
  return formatTime(time.getHours(), time.getMinutes())
}

// iMessage-style separator: "9:41 AM" today, "Mon 9:41 AM" before.
export function stampLabel(s) {
  if (!s || !s.hm) return ''
  return s.day === stamp().day ? 'Today ' + s.hm : s.wd + ' ' + s.hm
}
