// Shared by the watch, the side service and the Settings App. No @zos imports here.

// settingsStorage keys (phone).
export const KEY = {
  url: 'url', // Hermes API server base URL, e.g. https://hermes.example.com
  key: 'key', // API_SERVER_KEY
  session: 'session', // Hermes session id, so turns continue one conversation
  commands: 'commands', // JSON array of quick-command strings
  testAt: 'testAt', // Settings App -> side service: "test the connection now" (timestamp)
  health: 'health' // side service -> Settings App: JSON { ok, error, version, at }
}

export const DEFAULT_COMMANDS = ['What needs my attention today?', 'Summarize my unread messages', 'What are you working on?']

// Longest reply sent to the watch over BLE.
export const MAX_OUTPUT = 3000

export function newSessionId() {
  return 'watch-' + Date.now().toString(36)
}
