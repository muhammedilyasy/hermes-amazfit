# Hermes on Amazfit (Zepp OS Mini Program)

Watch remote for the user's Hermes agent (Nous Research), running on their server.
Targets every Zepp OS watch with API_LEVEL >= 3.0 (app.json minVersion 3.0), round (design 480) and
square (design 390). Developed on a Bip 6 (square 390 x 450, 86 px corners, API 4.2). Voice/keyboard
(`createKeyboard`, API 4.0) is feature-detected with `canType` (`utils/input.js`); without it the pages
hide the composer and offer smart replies only. API 3.0 is the floor because of `LocalStorage`.
See README.md for setup.

## Ground rules
- Only use APIs from the official Zepp OS docs (https://docs.zepp.com, source: github.com/zepp-health/zeppos-docs)
  and patterns from github.com/zepp-health/zeppos-samples. Keep any local clones OUTSIDE the project:
  `zeus build` compiles every .js under it.
- After every change: `node --import ./tools/preview/register.mjs tools/check.mjs` (layout exports +
  relative imports), `node --import ./tools/preview/register.mjs tools/test-side.mjs`, `zeus build`.
  UI changes: `python3 tools/preview/shots.py` (review `design/preview/_sheet.png`); Settings App changes:
  `sh tools/preview/settings.sh` (review `design/preview/settings.png`).
- Tools must be `.mjs`/`.py`/`.sh`: `zeus build` compiles every `.js` in the project and fails on Node code.

## Design (user request 2026-10-26: "exactly like iMessage on Apple Watch")
- One page, `page/home`: the conversation. Blue outgoing / gray incoming bubbles with tails (only on the
  last bubble of a run of messages), centered timestamps when 15+ min pass, "Delivered" / "Not Delivered ·
  Tap to retry" under your last message, typing dots (animated) + elapsed + Stop while a run is going,
  Allow / Deny pills for approvals, smart replies (first 4 quick commands), an "iMessage" field + blue mic
  composer, "New Conversation" link. Header: avatar, name, status ("Online", "typing…", errors), clock.
- Tokens in `utils/theme.js` are Apple dark-mode system colors. The phone Settings App (`setting/index.js`)
  looks like iOS Settings (contact card + grouped lists).
- Images come from `python3 tools/gen-assets.py [--name N --photo P --crop x0,y0,x1,y1]`: icon, avatar,
  bubble tails, mic, `setting/avatar.js`, `utils/agent.js` (default name) and app.json appName. The
  public repo uses the neutral default (name "Hermes", initials avatar).
- The maintainer's local copy is personalized as "Maximus" with a photo that is a copyrighted film still:
  never commit or push it. Before committing, run `python3 tools/gen-assets.py --name Hermes` (restores the
  defaults), commit, then re-run the personalization with the photo kept outside the repo.
- Every layout value lives in `page/home/index.{s,r}.layout.js` (same export names, enforced by
  `tools/check.mjs`). Images use `auto_scale`, so one asset per shape fits every screen size.
- Square: the system status bar is hidden (`HIDE_STATUS_BAR`; `setStatusBarVisible` is square-only).
  Round: clock at the top center, avatar + name centered under it; content stays inside the circle.
- Scrolling: after each render the page scrolls so the composer is in view, but never past the newest
  message (`FOCUS_Y`).
- Previews: `shots.py` renders every scene on bip6 (square, API 4), bip5unity (square 320, API 3),
  balance2 (round 480, API 4) and falcon (round 416, API 3).

## Architecture
- `app-side/index.js` (phone) is the only thing that talks to Hermes. It uses the **Runs API**
  (`POST /v1/runs` returns a run id at once; the watch POLLs every 2 s) so long agent turns never hit
  ZML's 60 s BLE request timeout. Methods: CONFIG, HEALTH, START, POLL, STOP, APPROVE, CLARIFY,
  NEW_SESSION. Failures are returned as `res(null, { error })`. The Settings App's "Test connection"
  writes `testAt`; `onSettingsChange` runs HEALTH and writes `health` (the page rebuilds on change).
- Settings (`setting/index.js`) store name, url, key, session, commands in settingsStorage; the API key
  never goes to the watch. Keys are in `utils/shared.js` (no @zos imports, shared by all three parts).
- Watch: `page/home` is the whole app. One run at a time; the thread (last 40 items), the run in progress
  and the cached agent name are in LocalStorage (`thread`, `run`, `agent`), so reopening resumes polling.
  A clarify question is answered through the composer (CLARIFY instead of START).
- Input: `createKeyboard` (API 4.0) with `inputType.VOICE` or `CHAR` (`utils/input.js`).
- Each START carries a watch-generated requestId sent as `Idempotency-Key`.
- ZML's BasePage assigns its own methods OVER the page's: never name a page method `request`, `call`,
  `httpRequest`, `sendFile`, `log`, `error`, `debug` (a page `call()` once broke every run with
  "cannot read property 'runId' of undefined"). The page's helper is `hermes(method, params)`.

## Hermes API behaviour (verified 2026-10-24 against Hermes 0.22.5 behind a Cloudflare Tunnel)
- Users enter their own server URL and key in the Settings App; never hardcode either. The setup
  prompt for a user's Hermes agent is `HERMES_SETUP.md`.
- `/health` is public (`{"status":"ok","platform":"hermes-agent","version":"0.22.5"}`), so HEALTH also
  calls `/v1/models` to check the key. 401 body: `{"error":{"message":"Invalid gateway API key ..."}}`.
- POST /v1/runs -> 202 `{run_id, status:"started", replayed}`. Client-chosen `session_id` works and
  continues the conversation. GET run: `status`, `output` (empty until completed, then the full
  text), `pending_controls` ([] when none), top-level `execution_generation`.
- /stop -> `{"status":"stopping"}`, then `cancelled` within ~2 s. Idempotent on finished runs.
- Each run costs ~18k input tokens: never start a run to "ping"; use HEALTH.
- Cloudflare HTML (challenge page, tunnel down) is reported as its own error (`cloudflareText()`).
- Polling pauses after 5 min (or 5 failed polls): "still working" note with Check again / Stop.

## Still unverified
- The fields of a `pending_controls` entry besides `prompt_id`: "smart" approval mode auto-approved the
  test, so it was never seen live. `pendingControl()` looks for the text in several fields.
- /clarify was never exercised.
- Whether Bip 6 firmware supports VOICE input in third-party apps.
