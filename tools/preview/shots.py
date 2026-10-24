"""Render every screen on Bip 6 into design/preview/ (+ _sheet.png contact sheet).

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


def shoot(name, full=False):
    page, params, store, responses, *advance = SCREENS[name]
    env = dict(os.environ, PV_ADVANCE_MS=str(advance[0] if advance else 0))
    res = subprocess.run(["node", "--import", "./tools/preview/register.mjs", "tools/preview/run.mjs", page, params, json.dumps(store), json.dumps(responses)],
                         cwd=ROOT, env=env, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"{name}: FAILED\n{res.stderr[-1500:]}")
        return None
    data_path = os.path.join(OUT, f".{name}.json")
    open(data_path, "w").write(res.stdout)
    png = os.path.join(OUT, f"{name}{'-full' if full else ''}.png")
    args = [sys.executable, os.path.join(HERE, "render.py"), data_path, png] + (["--full"] if full else [])
    subprocess.run(args, check=True)
    os.remove(data_path)
    return png


def main(names):
    os.makedirs(OUT, exist_ok=True)
    pngs = [(n, shoot(n)) for n in names]
    cols, cell = 4, 420
    rows = (len(pngs) + cols - 1) // cols
    sheet = Image.new("RGB", (cell * cols + 20, (cell + 50) * rows + 20), (60, 60, 64))
    d = ImageDraw.Draw(sheet)
    for i, (name, p) in enumerate(pngs):
        x, y = 20 + (i % cols) * cell, 30 + (i // cols) * (cell + 50)
        d.text((x, y - 18), name, fill=(220, 220, 220))
        if p:
            sheet.paste(Image.open(p), (x, y))
    sheet.save(os.path.join(OUT, "_sheet.png"))
    for n in ("home", "reply"):
        if n in names:
            shoot(n, full=True)
    print("wrote", os.path.join(OUT, "_sheet.png"))


if __name__ == "__main__":
    main(sys.argv[1:] or list(SCREENS))
