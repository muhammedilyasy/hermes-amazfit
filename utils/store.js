import { LocalStorage } from '@zos/storage'

const storage = new LocalStorage()

// last: { runId, input, status, output, error } of the most recent run, so a reply that
// finished while the app was closed can be reopened from Home.
export const KEY = { last: 'last' }

// Values are stored as JSON strings so objects round-trip on every firmware.
export function load(key, fallback) {
  const raw = storage.getItem(key)
  if (raw === undefined || raw === null || raw === '') return fallback
  try {
    return JSON.parse(raw)
  } catch (e) {
    return fallback
  }
}

export function save(key, value) {
  storage.setItem(key, JSON.stringify(value))
}
