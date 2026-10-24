"""Render every screen on four watches (square/round, with and without a keyboard) into
design/preview/, plus a contact sheet _sheet.png.

Usage: python3 tools/preview/shots.py [screen ...]
Needs Node 22+, Pillow, and Noto Sans in /tmp/sw-fonts (sh tools/preview/setup.sh).
Each screen is the page code run against mocked @zos/* APIs with scripted side-service
replies, so it checks layout, not runtime behavior.
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "design", "preview")

CONFIG = {"configured": True, "host": "hermes.example.com", "commands": ["What needs my attention today?", "Summarize my unread messages", "What are you working on?"]}
LAST = {"last": json.dumps({"runId": "run_1", "input": "Is the deploy done?", "status": "completed", "output": "Yes, deployed at 14:02."})}
REPLY = ("The staging deploy finished at 14:02 and all 128 checks passed. Two things need you: "
         "Maya asked for a review on the billing PR, and the nightly backup on db-2 failed "
         "with a disk-full error. Want me to clear old snapshots and re-run it?")
ASK = json.dumps({"input": "Is the deploy done and is anything on fire?", "requestId": "r1"})


def run_state(status, **extra):
    r = {"status": status, "done": status in ("completed", "failed", "cancelled", "interrupted"), "output": "", "control": None}
    r.update(extra)
    return {"START": {"runId": "run_1"}, "POLL": r}


SCREENS = {
    "home": ("page/home/index", "", LAST, dict(CONFIG=CONFIG, HEALTH={"ok": True})),
    "home-setup": ("page/home/index", "", {}, dict(CONFIG={"configured": False, "commands": []})),
    "home-offline": ("page/home/index", "", {}, dict(CONFIG=CONFIG, HEALTH={"error": "Blocked by Cloudflare (403)"})),
    "working": ("page/chat/index", ASK, {}, run_state("running")),
    "approval": ("page/chat/index", ASK, {}, run_state("waiting_for_approval", control={
        "kind": "approval", "requestId": "p1", "generation": 3, "text": "rm -rf /var/backups/db-2/snapshots/2026-09-*"})),
    "clarify": ("page/chat/index", ASK, {}, run_state("running", control={
        "kind": "clarify", "requestId": "p2", "generation": 4, "text": "Which environment: staging or production?"})),
    "reply": ("page/chat/index", ASK, {}, run_state("completed", output=REPLY)),
    "slow": ("page/chat/index", ASK, {}, run_state("running"), 5 * 60 * 1000 + 12000),
    "error": ("page/chat/index", ASK, {}, {"START": {"error": "API key rejected (401)"}}),
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
    for n in ("home", "reply"):
        if n in names:
            shoot(n, full=True)
    print("wrote", os.path.join(OUT, "_sheet.png"))


if __name__ == "__main__":
    main(sys.argv[1:] or list(SCREENS))
