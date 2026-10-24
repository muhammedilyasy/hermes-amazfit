#!/bin/sh
# Screenshot the phone Settings App preview into design/preview/settings.png (needs Google Chrome).
cd "$(dirname "$0")/../.." || exit 1
STORE=$(python3 -c '
import json, time
print(json.dumps({"url": "https://hermes.example.com", "key": "x", "session": "watch-mh5k2v1q",
  "health": json.dumps({"ok": True, "version": "0.22.5", "at": int(time.time() * 1000)}),
  "commands": json.dumps(["What needs my attention today?", "Summarize my unread messages", "What are you working on?"])}))')
mkdir -p design/preview
node --import ./tools/preview/register.mjs tools/preview/settings-html.mjs "$STORE" > design/preview/settings.html
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=800,1200 --screenshot="$PWD/design/preview/settings-raw.png" "file://$PWD/design/preview/settings.html" 2>/dev/null
python3 -c "
from PIL import Image
Image.open('design/preview/settings-raw.png').crop((0, 0, 390, 1200)).save('design/preview/settings.png')"
rm -f design/preview/settings-raw.png
echo "wrote design/preview/settings.png"
