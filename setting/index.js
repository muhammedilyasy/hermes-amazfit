// Settings App in the Zepp phone app, styled like iOS Settings in dark mode: a contact
// card for the agent, then grouped lists (Contact, Connection, Conversation, Smart Replies).
// Everything is saved to settingsStorage, where the side service reads it. The page
// rebuilds whenever settingsStorage changes, so "Test Connection" results show up live.
import { DEFAULT_COMMANDS, KEY, newSessionId } from '../utils/shared'
import { AVATAR } from './avatar'
import { AGENT } from '../utils/agent'

const C = {
  bg: '#000000',
  group: '#1c1c1e',
  separator: '#38383a',
  text: '#ffffff',
  secondary: '#8e8e93',
  blue: '#0a84ff',
  green: '#30d158',
  red: '#ff453a',
  orange: '#ff9f0a'
}
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Roboto, sans-serif"
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace"
const MASK = '••••••••••••'

const S = {
  page: { backgroundColor: C.bg, minHeight: '100vh', padding: '24px 16px 48px', color: C.text, fontFamily: FONT, boxSizing: 'border-box' },
  header: { color: C.secondary, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.02em', margin: '28px 16px 8px' },
  footer: { color: C.secondary, fontSize: '13px', lineHeight: '18px', margin: '8px 16px 0' },
  group: { backgroundColor: C.group, borderRadius: '12px', overflow: 'hidden' },
  row: { padding: '11px 16px', borderTop: '0.5px solid ' + C.separator },
  firstRow: { padding: '11px 16px' },
  label: { color: C.secondary, fontSize: '13px' },
  value: { color: C.text, fontSize: '17px', marginTop: '2px' },
  action: { color: C.blue, fontSize: '17px', textAlign: 'left', backgroundColor: 'transparent', border: 'none', padding: '0', width: '100%' },
  remove: { color: C.red, fontSize: '15px', backgroundColor: 'transparent', border: 'none', padding: '0 0 0 12px' }
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

// One grouped list: section header, rows, optional footer.
function section(title, rows, footer) {
  const body = rows.filter(Boolean).map((r, i) => View({ style: i === 0 ? S.firstRow : S.row }, [r]))
  return View({}, [
    Text({ style: S.header }, title),
    View({ style: S.group }, body),
    footer ? Text({ paragraph: true, style: S.footer }, footer) : null
  ].filter(Boolean))
}

function field(opts) {
  return TextInput({
    label: opts.label,
    placeholder: opts.placeholder,
    value: opts.value,
    labelStyle: S.label,
    subStyle: Object.assign({}, S.value, opts.mono ? { fontFamily: MONO, fontSize: '15px' } : {}),
    maxLength: opts.maxLength || 500,
    onChange: opts.onChange
  })
}

function action(label, onClick, color) {
  return Button({ label, style: Object.assign({}, S.action, color ? { color } : {}), onClick })
}

// "● Connected · Hermes 0.22.5 · just now" / error / not tested yet.
function status(health, configured) {
  let color = C.secondary
  let text = configured ? 'Not tested yet' : 'Add your server URL and API key'
  if (health && configured) {
    color = health.ok ? C.green : C.red
    text = (health.ok ? 'Connected' + (health.version ? ' · Hermes ' + health.version : '') : health.error || 'Connection failed') + ' · ' + ago(health.at)
  }
  return View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
    View({ style: { width: '8px', height: '8px', borderRadius: '4px', backgroundColor: color, marginRight: '10px', flexShrink: 0 } }),
    Text({ style: { color: health && configured ? C.text : C.secondary, fontSize: '15px' } }, text)
  ])
}

AppSettingsPage({
  build(props) {
    const storage = props.settingsStorage
    const name = (storage.getItem(KEY.name) || '').trim() || AGENT.name
    const url = storage.getItem(KEY.url) || ''
    const hasKey = !!storage.getItem(KEY.key)
    const commands = readJSON(storage, KEY.commands, DEFAULT_COMMANDS)
    const health = readJSON(storage, KEY.health, null)
    const session = storage.getItem(KEY.session) || ''
    const saveCommands = (list) => storage.setItem(KEY.commands, JSON.stringify(list))

    // Contact card, like the top of a conversation's details in Messages.
    const card = View({ style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '8px' } }, [
      Image({ src: AVATAR, width: 88, height: 88, style: { borderRadius: '44px' } }),
      Text({ align: 'center', style: { color: C.text, fontSize: '28px', fontWeight: '600', marginTop: '12px' } }, name),
      Text({ align: 'center', style: { color: C.secondary, fontSize: '15px', marginTop: '2px' } }, 'Hermes agent on your watch')
    ])

    const contact = section('Contact', [
      field({ label: 'Name', placeholder: AGENT.name, value: storage.getItem(KEY.name) || '', maxLength: 40, onChange: (v) => storage.setItem(KEY.name, (v || '').trim()) })
    ], 'Shown at the top of the conversation on your watch. Reopen the app on the watch to update it.')

    const connection = section('Connection', [
      field({ label: 'Server URL', placeholder: 'https://hermes.example.com', value: url, onChange: (v) => storage.setItem(KEY.url, (v || '').trim()) }),
      field({
        label: 'API Key',
        placeholder: 'API_SERVER_KEY',
        value: hasKey ? MASK : '',
        mono: true,
        onChange: (v) => {
          const k = (v || '').trim()
          if (k && k !== MASK) storage.setItem(KEY.key, k)
        }
      }),
      status(health, !!(url && hasKey)),
      action('Test Connection', () => storage.setItem(KEY.testAt, String(Date.now())))
    ], 'The API_SERVER_KEY from ~/.hermes/.env. It stays on this phone and is never sent to the watch.')

    const conversation = section('Conversation', [
      View({}, [
        Text({ style: S.label }, 'Session'),
        Text({ style: Object.assign({}, S.value, { fontFamily: MONO, fontSize: '15px', color: session ? C.text : C.secondary }) }, session || 'Created with your first message')
      ]),
      action('Start New Conversation', () => storage.setItem(KEY.session, newSessionId()))
    ], 'Your watch messages continue this Hermes session until you start a new one.')

    const replies = section('Smart Replies', commands.map((cmd, i) =>
      View({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
        View({ style: { flex: 1 } }, [
          TextInput({
            label: '',
            value: cmd,
            subStyle: { color: C.text, fontSize: '17px' },
            maxLength: 200,
            onChange: (v) => {
              const t = (v || '').trim()
              if (!t) return
              const next = commands.slice()
              next[i] = t
              saveCommands(next)
            }
          })
        ]),
        Button({ label: 'Remove', style: S.remove, onClick: () => saveCommands(commands.filter((_, j) => j !== i)) })
      ])
    ).concat([
      commands.length < 8
        ? TextInput({
            label: '',
            placeholder: 'Add a reply…',
            value: '',
            subStyle: { color: C.blue, fontSize: '17px' },
            maxLength: 200,
            onChange: (v) => {
              const t = (v || '').trim()
              if (t) saveCommands(commands.concat([t]).slice(0, 8))
            }
          })
        : null
    ]), 'One-tap replies under the conversation on your watch (the first 4 are shown).')

    return View({ style: S.page }, [card, contact, connection, conversation, replies])
  }
})
