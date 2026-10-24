#!/bin/sh
# One-time setup for the preview tool: Noto Sans (Zepp OS system font, from Zepp's
# design resources) and its glyph widths, used to measure text like getTextLayout does.
# Needs a Python with Pillow and fontTools: PY=/path/to/python sh tools/preview/setup.sh
set -e
PY=${PY:-python3}
mkdir -p /tmp/sw-fonts
curl -sSL -o /tmp/sw-fonts/NotoSans-Regular.ttf https://upload-cdn.zepp.com/20230908/Noto-Sans-Regular.ttf
$PY -I -c "
import json
from fontTools.ttLib import TTFont
f = TTFont('/tmp/sw-fonts/NotoSans-Regular.ttf'); cm = f.getBestCmap(); hm = f['hmtx']; upm = f['head'].unitsPerEm
json.dump({chr(c): hm[g][0] / upm for c, g in cm.items() if c < 0x2100}, open('/tmp/sw-fonts/widths.json', 'w'))
"
echo "preview fonts ready"
