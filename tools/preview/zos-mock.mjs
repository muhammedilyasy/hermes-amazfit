// One mock module standing in for every @zos/* module. It records widgets instead of drawing.
const S = globalThis.__PV
const names = (o) => new Proxy(o, { get: (t, k) => (k in t ? t[k] : String(k)) })

export const widget = names({})
export const prop = names({})
export const event = names({})
export const anim_status = names({})
export const align = { LEFT: 'left', RIGHT: 'right', CENTER_H: 'center', CENTER_V: 'middle', TOP: 'top', BOTTOM: 'bottom', CENTER: 'center' }
export const text_style = { NONE: 'none', WRAP: 'wrap', ELLIPSIS: 'ellipsis' }

function make(type, opts, parent) {
  const w = Object.assign({ type }, opts, { _parent: parent ? parent._id : null, _id: S.widgets.length })
  S.widgets.push(w)
  return {
    _w: w,
    setProperty(p, v) {
      if (p === 'MORE') Object.assign(w, v)
      else if (p === 'VISIBLE') w._hidden = !v
      return 1
    },
    getProperty() { return 0 },
    addEventListener() {},
    createWidget: (t, o) => make(t, o, w)
  }
}
export function createWidget(t, o) { return make(t, o, null) }
export function deleteWidget(h) { if (h && h._w) h._w._deleted = true }
// Greedy word wrap with Noto Sans widths, close to the firmware's layout.
export function getTextLayout(text, o) {
  const width = (str) => { let em = 0; for (const c of str) em += S.widths[c] ?? 0.56; return Math.ceil(em * o.text_size) }
  const lh = Math.ceil(o.text_size * 1.16)
  if (!o.wrapped || !o.text_width) return { width: width(String(text)), height: lh, rows: 1, result: 0 }
  let rows = 0
  for (const para of String(text).split('\n')) {
    let cur = ''
    rows += 1
    for (const word of para.split(' ')) {
      const trial = cur ? cur + ' ' + word : word
      if (width(trial) <= o.text_width) { cur = trial; continue }
      if (cur) { rows += 1; cur = '' }
      // A word wider than the box breaks between characters.
      for (const c of word) {
        if (cur && width(cur + c) > o.text_width) { rows += 1; cur = '' }
        cur += c
      }
    }
  }
  const capped = o.rows_max ? Math.min(rows, o.rows_max) : rows
  return { width: o.text_width, height: capped * lh, rows: capped, result: capped < rows ? 1 : 0 }
}
export const inputType = { EMOJI: 0, NUM: 1, CHAR: 2, VOICE: 3, JSKB: 4 }
// PV_API=3 simulates a Zepp OS 3.x watch, which has no system keyboard.
export const createKeyboard = process.env.PV_API === '3' ? undefined : function (o) { S.keyboard = o.inputType; return {} }
export function deleteKeyboard() {}
export function updateStatusBarTitle(t) { S.statusTitle = t }
export function setStatusBarVisible(v) { S.statusVisible = v }

export function px(v) { return Math.ceil((v / S.dw) * S.width) }
export const log = { getLogger: () => ({ log() {}, debug() {}, warn() {}, error() {} }) }
export function getText(k) { return S.po[k] ?? k }

export function push(o) { S.nav.push(o) }
export function replace(o) { S.nav.push(o) }
export function back() {}
export function exit() {}

export function onGesture() {}
export function offGesture() {}
export function onKey() {}
export function offKey() {}
export function onDigitalCrown() {}
export function offDigitalCrown() {}
export function showToast(o) { S.toasts.push(o) }
export const GESTURE_RIGHT = 'right', GESTURE_UP = 'up', GESTURE_LEFT = 'left', GESTURE_DOWN = 'down'
export const KEY_BACK = 'back', KEY_HOME = 'home', KEY_SELECT = 'select', KEY_EVENT_CLICK = 'click'

export function setPageBrightTime() { return 0 }
export function resetPageBrightTime() {}
export function pauseDropWristScreenOff() {}
export function resetDropWristScreenOff() {}
export function setWakeUpRelaunch() {}

export const SCREEN_SHAPE_ROUND = 1, SCREEN_SHAPE_SQUARE = 0
export function getDeviceInfo() { return { width: S.width, height: S.height, screenShape: S.shape === 'r' ? 1 : 0 } }

export const SCROLL_MODE_FREE = 'free', SCROLL_MODE_SWIPER = 'swiper', SCROLL_MODE_SWIPER_HORIZONTAL = 'swiperH'
export function setScrollMode() { return true }
export function scrollTo(o) { S.scrollY = typeof o === 'number' ? o : (o && o.y) || 0 }
export function setScrollLock() {}
export function getScrollTop() { return 0 }

// Fixed clock: Thursday 2026-10-22, 22:30 local.
export class Time {
  getTime() { return S.nowMs }
  getHours() { return S.clock.hour }
  getMinutes() { return S.clock.minute }
  getSeconds() { return 0 }
  getDay() { return S.clock.weekday }
  getFullYear() { return 2026 }
  getMonth() { return 10 }
  getDate() { return 22 }
}
export class Vibrator { start() {} stop() {} setMode() {} }
export class Buzzer { isEnabled() { return false } getSourceType() { return { ALARM: 0 } } start() {} stop() {} }
export class Sleep {
  updateInfo() {}
  getStageConstantObj() { return { WAKE_STAGE: 7, REM_STAGE: 8, LIGHT_STAGE: 4, DEEP_STAGE: 5 } }
  getStage() { return [] }
  getSleepingStatus() { return 1 }
}
export class HeartRate { getLast() { return 60 } getResting() { return 55 } }
export const VIBRATOR_SCENE_SHORT_LIGHT = 1, VIBRATOR_SCENE_SHORT_MIDDLE = 2, VIBRATOR_SCENE_SHORT_STRONG = 3
export const VIBRATOR_SCENE_STRONG_REMINDER = 4, VIBRATOR_SCENE_TIMER = 5

export const TIME_FORMAT_24 = 24, TIME_FORMAT_12 = 12
export function getTimeFormat() { return S.h24 ? 24 : 12 }

export class LocalStorage {
  getItem(k, d) { return k in S.store ? S.store[k] : d }
  setItem(k, v) { S.store[k] = v }
  removeItem(k) { delete S.store[k]; return true }
  clear() {}
}
export function set() { return ++S.alarmId }
export function cancel() { return 0 }
export function queryPermission(o) { return o.permissions.map(() => 2) }
export function requestPermission(o) { o.callback && o.callback([2]) }
export function notify() { return 1 }
export function readFileSync() { return '[]' }
export function writeFileSync() {}
export function getAllAlarms() { return [] }
export function setLaunchAppTimeout() { return 1 }
export function clearLaunchAppTimeout() {}
export function getPackageInfo() { return { appId: 29273 } }
