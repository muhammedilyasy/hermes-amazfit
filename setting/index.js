// Settings App in the Zepp phone app, styled after resend.com (dark): black page, gray
// cards with hairline borders, white primary button, small uppercase eyebrows.
// Everything is saved to settingsStorage, where the side service reads it. The page
// rebuilds whenever settingsStorage changes, so "Test connection" results show up live.
import { DEFAULT_COMMANDS, KEY, newSessionId } from '../utils/shared'
import { LOGO } from './logo'

const C = {
  bg: '#000000',
  card: '#141517', // gray-1
  field: '#191b1e', // gray-2
  border: '#293034', // gray-4
  text: '#f0f0f0', // gray-12
  muted: '#a1a4a5', // gray-11
  faint: '#6e7679', // gray-9
  green: '#3dd68c',
  red: '#ff9592',
  amber: '#ffca16'
}
const FONT = "-apple-system, BlinkMacSystemFont, Inter, 'Segoe UI', Roboto, sans-serif"
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace"
const MASK = '••••••••••••'

const S = {
  page: { backgroundColor: C.bg, minHeight: '100vh', padding: '28px 20px 48px', color: C.text, fontFamily: FONT, boxSizing: 'border-box' },
  card: { backgroundColor: C.card, border: '1px solid ' + C.border, borderRadius: '16px', padding: '18px 16px', marginTop: '16px' },
  eyebrow: { color: C.faint, fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' },
  hint: { color: C.faint, fontSize: '12px', lineHeight: '18px', marginTop: '8px' },
  label: { color: C.muted, fontSize: '12px', fontWeight: '500' },
  value: { color: C.text, fontSize: '15px', backgroundColor: C.field, border: '1px solid ' + C.border, borderRadius: '10px', padding: '10px 12px', marginTop: '6px' },
  primary: { backgroundColor: '#fdfdfd', color: '#000000', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '600', padding: '10px 16px', marginTop: '14px', width: '100%' },
  secondary: { backgroundColor: C.field, color: C.text, borderRadius: '12px', border: '1px solid ' + C.border, fontSize: '14px', fontWeight: '600', padding: '10px 16px', marginTop: '14px', width: '100%' },
  ghost: { backgroundColor: 'transparent', color: C.red, borderRadius: '10px', border: '1px solid ' + C.border, fontSize: '12px', fontWeight: '600', padding: '6px 10px', marginLeft: '10px' },
  divider: { borderTop: '1px solid ' + C.border, margin: '10px 0' }
}

function readJSON(storage, key, fallback) {
  try {
    return JSON.parse(storage.getItem(key) || 'null') || fallback
  } catch (e) {
    return fallback
  }
}

function ago(at) {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000))
  return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : new Date(at).toLocaleString()
}

function card(eyebrow, children) {
  return View({ style: S.card }, [Text({ style: S.eyebrow }, eyebrow)].concat(children))
}

function hint(text) {
  return Text({ paragraph: true, style: S.hint }, text)
}

function field(opts) {
  return View({ style: { marginTop: '12px' } }, [
    TextInput({
      label: opts.label,
      placeholder: opts.placeholder,
      value: opts.value,
      labelStyle: S.label,
      subStyle: Object.assign({}, S.value, opts.mono ? { fontFamily: MONO } : {}),
      maxLength: opts.maxLength || 500,
      onChange: opts.onChange
    })
  ])
}

// "● Connected · Hermes 0.22.5 · just now" / error / not tested yet.
function status(health, configured) {
  let color = C.faint
  let text = configured ? 'Not tested yet' : 'Add your server URL and API key'
  if (health && configured) {
    color = health.ok ? C.green : C.red
    text = health.ok ? 'Connected' + (health.version ? ' · Hermes ' + health.version : '') : health.error || 'Connection failed'
    text += ' · ' + ago(health.at)
  }
  return View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: C.field, border: '1px solid ' + C.border, borderRadius: '999px', padding: '6px 12px', marginTop: '14px' } }, [
    View({ style: { width: '8px', height: '8px', borderRadius: '4px', backgroundColor: color, marginRight: '8px', flexShrink: 0 } }),
    Text({ style: { color: health && configured ? C.text : C.muted, fontSize: '13px' } }, text)
  ])
}

AppSettingsPage({
  build(props) {
    const storage = props.settingsStorage
    const url = storage.getItem(KEY.url) || ''
    const hasKey = !!storage.getItem(KEY.key)
    const commands = readJSON(storage, KEY.commands, DEFAULT_COMMANDS)
    const health = readJSON(storage, KEY.health, null)
    const session = storage.getItem(KEY.session) || ''
    const saveCommands = (list) => storage.setItem(KEY.commands, JSON.stringify(list))

    const header = View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
      Image({ src: LOGO, width: 44, height: 44, style: { borderRadius: '10px', marginRight: '12px' } }),
      View({}, [
        Text({ style: { color: C.text, fontSize: '22px', fontWeight: '700', letterSpacing: '-0.01em' } }, 'Hermes'),
        Text({ style: { color: C.muted, fontSize: '13px', marginTop: '2px' } }, 'Your agent, on your wrist')
      ])
    ])

    const server = card('Connection', [
      field({
        label: 'Server URL',
        placeholder: 'https://hermes.example.com',
        value: url,
        onChange: (val) => storage.setItem(KEY.url, (val || '').trim())
      }),
      field({
        label: 'API key',
        placeholder: 'API_SERVER_KEY',
        value: hasKey ? MASK : '',
        mono: true,
        onChange: (val) => {
          const v = (val || '').trim()
          if (v && v !== MASK) storage.setItem(KEY.key, v)
        }
      }),
      hint('The value of API_SERVER_KEY in ~/.hermes/.env. It is stored on this phone only and never sent to the watch.'),
      status(health, !!(url && hasKey)),
      Button({ label: 'Test connection', style: S.primary, onClick: () => storage.setItem(KEY.testAt, String(Date.now())) })
    ])

    const conversation = card('Conversation', [
      Text({ style: S.label }, 'Session'),
      Text({ style: Object.assign({}, S.value, { fontFamily: MONO, fontSize: '13px', color: session ? C.text : C.faint }) }, session || 'Created with your first message'),
      Button({ label: 'Start a new conversation', style: S.secondary, onClick: () => storage.setItem(KEY.session, newSessionId()) }),
      hint('Messages from the watch continue this Hermes session until you start a new one. You can also do it from the watch.')
    ])

    const rows = commands.map((cmd, i) =>
      View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
        View({ style: { flex: 1 } }, [
          TextInput({
            label: '',
            value: cmd,
            subStyle: Object.assign({}, S.value, { marginTop: '8px' }),
            maxLength: 200,
            onChange: (val) => {
              const v = (val || '').trim()
              if (!v) return
              const next = commands.slice()
              next[i] = v
              saveCommands(next)
            }
          })
        ]),
        Button({ label: 'Remove', style: S.ghost, onClick: () => saveCommands(commands.filter((_, j) => j !== i)) })
      ])
    )

    const quick = card('Quick commands', rows.concat([
      commands.length < 8
        ? field({
            label: 'Add a command',
            placeholder: 'e.g. What changed in the repo today?',
            value: '',
            onChange: (val) => {
              const v = (val || '').trim()
              if (v) saveCommands(commands.concat([v]).slice(0, 8))
            }
          })
        : hint('That is the maximum of 8.'),
      hint('One-tap buttons on the watch. Reopen Hermes on the watch to see changes.')
    ]))

    const footer = Text({ paragraph: true, align: 'center', style: { color: C.faint, fontSize: '11px', marginTop: '24px' } }, 'Hermes for Amazfit · talks to your server through this phone')

    return View({ style: S.page }, [header, server, conversation, quick, footer])
  }
})
