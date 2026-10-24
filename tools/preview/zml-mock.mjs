// ZML stand-in: page requests resolve with the scripted response for their method
// (globalThis.__PV.responses), or reject like a disconnected phone.
export function BaseApp(o) { return o }
// Like the real ZML, the mixin methods are assigned over the page's own methods, so a
// page method named request/call/httpRequest/sendFile is silently replaced.
export function BasePage(o) {
  return Object.assign(o, {
    request({ method }) {
      const r = globalThis.__PV.responses[method]
      return r === undefined ? Promise.reject(new Error('offline')) : Promise.resolve(r)
    },
    call() {},
    httpRequest() { return Promise.reject(new Error('mock')) },
    sendFile() {}
  })
}
export function BaseSideService(o) { return o }
// Backed by globalThis.__SETTINGS when a test provides it.
export const settingsLib = {
  getItem(k) { const m = globalThis.__SETTINGS; return m && k in m ? m[k] : null },
  setItem(k, v) { if (globalThis.__SETTINGS) globalThis.__SETTINGS[k] = v }
}
