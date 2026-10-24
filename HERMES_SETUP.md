# Set up Hermes for the watch app

Copy everything in the box below and send it to your **Hermes agent** (in the terminal, Telegram,
or wherever you talk to it). Hermes will turn on its API server, make it reachable over HTTPS, test
it, and reply with the **URL** and **API key** to enter in the Zepp app.

> The API server gives full access to Hermes' tools, including the terminal. Treat the API key like a
> password: don't share it or post it anywhere.

```text
Please set up your API server so I can control you from my Amazfit watch app
("Hermes for Amazfit"). The phone's Zepp app will call your Runs API over HTTPS:
POST /v1/runs, GET /v1/runs/{id}, POST /v1/runs/{id}/stop, /approval, /clarify,
plus GET /health and GET /v1/models. Do the steps below. Show me any config change
before applying it, and ask me before anything that costs money or opens a port to the
internet.

1. Enable the API server
   - In ~/.hermes/.env (or the active profile's .env), set:
       API_SERVER_ENABLED=true
       API_SERVER_KEY=<generate a new strong key with `openssl rand -hex 32`>
       API_SERVER_HOST=127.0.0.1
     If API_SERVER_KEY is already set, keep the existing key.
   - The gateway has to restart to load this. If you are running inside that gateway,
     don't kill yourself mid-task: finish the other steps first, then schedule a delayed
     restart in the background (e.g. `sleep 5 && <restart command>`) or tell me the exact
     command to run, and say which you chose.

2. Make it reachable from my phone over HTTPS
   Keep Hermes bound to 127.0.0.1 and put an HTTPS tunnel or proxy in front of port 8642.
   Never bind it to 0.0.0.0 or open port 8642 in a firewall. Check what's installed and
   pick the first option that fits, then tell me which one you used:
   a) Cloudflare Tunnel (`cloudflared`) if it's installed and I have a domain on
      Cloudflare: add an ingress rule https://<subdomain>.<my-domain> -> http://127.0.0.1:8642
      to the existing tunnel (ask me for the hostname). If it's Cloudflare, also check that
      Bot Fight Mode / WAF rules won't block non-browser clients on that hostname.
   b) Tailscale Funnel if `tailscale` is installed: `tailscale funnel --bg 8642`, which
      gives https://<machine>.<tailnet>.ts.net.
   c) An existing reverse proxy with TLS (Caddy/nginx): propose a site block that proxies
      to 127.0.0.1:8642 and ask before applying.
   d) None of these: stop and explain my options (e.g. installing cloudflared or
      Tailscale) in plain words.

3. Verify through the public HTTPS URL (after the restart). Report the HTTP status of each:
   a) GET  <URL>/health                           -> expect 200 {"status":"ok",...}
   b) GET  <URL>/v1/models with no auth header    -> expect 401
   c) GET  <URL>/v1/models with "Authorization: Bearer <key>" -> expect 200
   d) POST <URL>/v1/runs with the key, header "Idempotency-Key: setup-test-1" and body
      {"input":"Reply with just the word pong","session_id":"watch-setup-test"},
      then poll GET <URL>/v1/runs/<run_id> every 2 s until the status is completed,
      failed, cancelled or interrupted. Expect "completed" with output "pong".
   If anything fails, fix it or tell me exactly what's wrong.

4. Reply to me with ONLY this summary, so I can copy it into the Zepp app:

   Server URL: https://...
   API key:    <the API_SERVER_KEY value>
   Checks:     health OK / auth OK / test run OK  (or what failed)
   Changed:    <one line per config change you made>

   Show the key only in this private reply. Don't write it anywhere else.
```

## When Hermes replies

1. In the **Zepp app**, go to **Device → General → Developer settings → Add mini app** and open
   **Hermes** → **Settings** (README, step 6).
2. Paste the **Server URL** and **API key**, then tap **Test connection**.
   It should say **Connected · Hermes x.y.z**.
3. Open Hermes on your watch. The header shows a green **Online**.

## Troubleshooting

| What you see | What it means |
| --- | --- |
| `API key rejected (401)` / `Invalid gateway API key` | The key in the Zepp app doesn't match `API_SERVER_KEY`. Paste it again. |
| `Blocked by Cloudflare (403)` | Cloudflare's bot protection blocked the phone. Ask Hermes to allow non-browser clients on that hostname. |
| `Hermes or tunnel is down (502/530)` | The tunnel is running but Hermes isn't (or the other way round). Ask Hermes to restart the gateway and tunnel. |
| `Hermes is busy (too many runs)` | More than 10 runs at once. Wait, or raise `max_concurrent_runs`. |
| Watch says **No phone** | Open the Zepp app on your phone and keep Bluetooth on. |
