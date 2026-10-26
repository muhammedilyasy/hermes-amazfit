import { LocalStorage } from '@zos/storage'

const storage = new LocalStorage()

export const KEY = {
  thread: 'thread', // [{ id, from: 'me' | 'agent' | 'note', text, at, state?, tone? }], newest last
  run: 'run', // the run in progress: { runId, requestId, msgId, startedAt } or null
  agent: 'agent' // { name } cached from the phone, so the header shows it instantly
}

// Values are stored as JSON strings so objects round-trip on every firmware.
export function load(key, fallback) {
  const raw = storage.getItem(key)
  if (raw === undefined || raw === null || raw === '') return fallback
  try {
    const v = JSON.parse(raw)
    return v === null || v === undefined ? fallback : v
  } catch (e) {
    return fallback
  }
}

export function save(key, value) {
  storage.setItem(key, JSON.stringify(value))
}
