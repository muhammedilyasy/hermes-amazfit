"""Render every screen on four watches (square/round, with and without a keyboard) into
design/preview/, plus a contact sheet _sheet.png.

Usage: python3 tools/preview/shots.py [screen ...]
Needs Node 22+, Pillow, and Noto Sans in /tmp/sw-fonts (sh tools/preview/setup.sh).
Each screen is the page code run against mocked @zos/* APIs with scripted side-service
replies, so it checks layout, not runtime behavior.
"""
import json
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "design", "preview")

NAME = re.search(r"name: '([^']*)'", open(os.path.join(ROOT, "utils", "agent.js")).read()).group(1)
CONFIG = {"configured": True, "host": "hermes.example.com", "name": NAME,
          "commands": ["What needs my attention?", "Summarize my inbox", "Status of my servers"]}
NOW = 1792708200000  # matches the mock clock (Thu 2026-10-22 22:30)


def msg(i, frm, text, mins_ago, hm, **extra):
    return dict({"id": f"m{i}", "from": frm, "text": text, "at": NOW - mins_ago * 60000,
                 "day": "2026-10-22", "wd": "Thu", "hm": hm}, **extra)


THREAD = [
    msg(1, "me", "Is the deploy done?", 42, "9:48 PM", state="sent"),
    msg(2, "agent", "Yes. Staging deployed at 9:47 PM and all 128 checks passed.", 41, "9:49 PM"),
    msg(3, "me", "Anything on fire?", 12, "10:18 PM", state="sent"),
    msg(4, "agent", "The nightly backup on db-2 failed with a disk-full error.", 11, "10:19 PM"),
    msg(5, "agent", "Want me to clear old snapshots and re-run it?", 11, "10:19 PM"),
]
ASKED = THREAD + [msg(6, "me", "Yes, do it", 1, "10:29 PM", state="sent")]
RUN = {"runId": "run_1", "requestId": "r1", "msgId": "m6", "startedAt": NOW - 12000}


def store(thread, run=None):
    s = {"thread": json.dumps(thread), "agent": json.dumps({"name": NAME})}
    if run:
        s["run"] = json.dumps(run)
    return s


def poll(status="running", control=None, **extra):
    r = {"status": status, "done": status in ("completed", "failed", "cancelled", "interrupted"), "output": "", "control": control}
    r.update(extra)
    return r


OK = dict(CONFIG=CONFIG, HEALTH={"ok": True})
SCREENS = {
    "empty": ("page/home/index", "", store([]), OK),
    "thread": ("page/home/index", "", store(THREAD), OK),
    "typing": ("page/home/index", "", store(ASKED, RUN), dict(OK, POLL=poll())),
    "approval": ("page/home/index", "", store(ASKED, RUN), dict(OK, POLL=poll("waiting_for_approval", {
        "kind": "approval", "requestId": "p1", "generation": 3, "text": "rm -rf /var/backups/db-2/snapshots/2026-09-*"}))),
    "question": ("page/home/index", "", store(ASKED, RUN), dict(OK, POLL=poll("running", {
        "kind": "clarify", "requestId": "p2", "generation": 4, "text": "Keep the last 7 days of snapshots, or 14?"}))),
    "failed": ("page/home/index", "", store(THREAD[:4] + [msg(5, "me", "Restart nginx", 1, "10:29 PM", state="failed", error="Blocked by Cloudflare (403)")]), dict(CONFIG=CONFIG, HEALTH={"error": "Blocked by Cloudflare (403)"})),
    "setup": ("page/home/index", "", store([]), dict(CONFIG={"configured": False, "name": NAME, "commands": []})),
    "slow": ("page/home/index", "", store(ASKED, RUN), dict(OK, POLL=poll()), 5 * 60 * 1000 + 12000),
}


# (name, shape, API level). API 3 = Zepp OS 3.x, no system keyboard.
DEVICES = [("bip6", "s", 4), ("bip5unity", "s", 3), ("balance2", "r", 4), ("falcon", "r", 3)]


def shoot(name, device=("bip6", "s", 4), full=False):
    page, params, store, responses, *advance = SCREENS[name]
    dev, shape, api = device
    env = dict(os.environ, PV_ADVANCE_MS=str(advance[0] if advance else 0), PV_DEVICE=dev, PV_SHAPE=shape, PV_API=str(api))
    res = subprocess.run(["node", "--import", "./tools/preview/register.mjs", "tools/preview/run.mjs", page, params, json.dumps(store), json.dumps(responses)],
                         cwd=ROOT, env=env, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"{name}/{dev}: FAILED\n{res.stderr[-1500:]}")
        return None
    tag = name if dev == "bip6" else f"{name}-{dev}"
    data_path = os.path.join(OUT, f".{tag}.json")
    open(data_path, "w").write(res.stdout)
    png = os.path.join(OUT, f"{tag}{'-full' if full else ''}.png")
    args = [sys.executable, os.path.join(HERE, "render.py"), data_path, png] + (["--full"] if full else [])
    subprocess.run(args, check=True)
    os.remove(data_path)
    return png


def main(names):
    """One row per screen, one column per watch, in _sheet.png."""
    os.makedirs(OUT, exist_ok=True)
    cell = 500
    sheet = Image.new("RGB", (cell * len(DEVICES) + 20, (cell + 40) * len(names) + 40), (60, 60, 64))
    d = ImageDraw.Draw(sheet)
    for c, (dev, shape, api) in enumerate(DEVICES):
        d.text((20 + c * cell, 6), f"{dev} (API {api})", fill=(230, 230, 230))
    for r, name in enumerate(names):
        y = 40 + r * (cell + 40)
        d.text((20, y - 16), name, fill=(220, 220, 220))
        for c, device in enumerate(DEVICES):
            p = shoot(name, device)
            if p:
                im = Image.open(p)
                sheet.paste(im, (20 + c * cell + (cell - im.width) // 2, y + (cell - im.height) // 2))
    sheet.save(os.path.join(OUT, "_sheet.png"))
    for n in ("thread", "approval"):
        if n in names:
            shoot(n, full=True)
    print("wrote", os.path.join(OUT, "_sheet.png"))


if __name__ == "__main__":
    main(sys.argv[1:] or list(SCREENS))
