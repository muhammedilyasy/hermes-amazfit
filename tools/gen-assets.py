"""Generate every image the app uses, and set the agent's name.

  python3 tools/gen-assets.py                                # defaults (name from utils/agent.js)
  python3 tools/gen-assets.py --name Maximus --photo me.jpg  # your agent's name and picture

Writes, for both square (s) and round (r) screens:
  assets/default.{s,r}/icon.png        app icon (round photo, or iMessage-style initials)
  assets/default.{s,r}/avatar.png      header avatar
  assets/default.{s,r}/tail-in.png     gray bubble tail (incoming, bottom-left)
  assets/default.{s,r}/tail-out.png    blue bubble tail (outgoing, bottom-right)
  assets/default.{s,r}/mic.png         microphone glyph for the voice button
  setting/avatar.js                    avatar as base64 for the phone Settings App
  utils/agent.js                       default agent name
  app.json                             app name shown in the watch's app list
  docs/icon.png                        README icon
Without --photo the avatar is the agent's initials on Apple's gray contact gradient.
Optional: --crop x0,y0,x1,y1 to choose the square of the photo to use (default: centered).
"""
import argparse
import base64
import io
import json
import os
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SS = 8  # supersampling for smooth edges

# Per shape: design width scale relative to square (round layouts are ~1.2x larger).
SHAPES = {"s": 1.0, "r": 1.2}
GRAY = (0x26, 0x26, 0x28, 255)
BLUE = (0x0A, 0x84, 0xFF, 255)
WHITE = (255, 255, 255, 255)
FONT = "/System/Library/Fonts/SFNS.ttf"


def circle_mask(size):
    m = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * SS - 1, size * SS - 1), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def photo_face(path, crop, size):
    im = Image.open(path).convert("RGB")
    if crop:
        box = tuple(int(v) for v in crop.split(","))
    else:
        s = min(im.size)
        box = ((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2)
    face = im.crop(box).resize((size, size), Image.LANCZOS).convert("RGBA")
    face.putalpha(circle_mask(size))
    return face


def initials_face(name, size):
    """Apple's contact placeholder: gray gradient disc with white initials."""
    top, bottom = (0xA5, 0xAB, 0xB8), (0x85, 0x89, 0x94)
    g = Image.new("RGBA", (size, size))
    px = g.load()
    for y in range(size):
        t = y / max(1, size - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,)
        for x in range(size):
            px[x, y] = c
    letters = "".join(w[0] for w in name.split()[:2]).upper() or "?"
    d = ImageDraw.Draw(g)
    f = ImageFont.truetype(FONT, int(size * (0.44 if len(letters) == 1 else 0.38)))
    try:
        f.set_variation_by_name("Semibold")
    except Exception:
        pass
    l, t, r, b = d.textbbox((0, 0), letters, font=f)
    d.text(((size - (r - l)) / 2 - l, (size - (b - t)) / 2 - t), letters, font=f, fill=WHITE)
    g.putalpha(circle_mask(size))
    return g


def tail(w, h, color, mirror):
    """iMessage bubble tail: a small hook that curls out of the bubble's bottom corner.
    Drawn for the incoming (left) side; mirrored for outgoing."""
    W, H = w * SS, h * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def bez(p0, p1, p2, n=40):
        return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                 (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (i / n for i in range(n + 1))]

    pts = [(W, 0), (W, H)]  # right edge sits under the bubble
    pts += bez((W, H), (W * 0.45, H), (0, H * 0.96))  # bottom edge out to the tip
    pts += bez((0, H * 0.96), (W * 0.55, H * 0.8), (W * 0.62, 0))  # concave back up into the bubble
    d.polygon(pts, fill=color)
    img = img.resize((w, h), Image.LANCZOS)
    return img.transpose(Image.FLIP_LEFT_RIGHT) if mirror else img


def mic(size):
    W = size * SS
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = W / 2
    cw, ch = W * 0.30, W * 0.50  # capsule
    d.rounded_rectangle((cx - cw / 2, W * 0.08, cx + cw / 2, W * 0.08 + ch), radius=cw / 2, fill=WHITE)
    lw = int(W * 0.075)
    aw = W * 0.52
    d.arc((cx - aw / 2, W * 0.08 + ch * 0.35, cx + aw / 2, W * 0.08 + ch * 1.22), 0, 180, fill=WHITE, width=lw)
    d.rectangle((cx - lw / 2, W * 0.08 + ch * 1.2, cx + lw / 2, W * 0.88), fill=WHITE)
    d.rounded_rectangle((cx - W * 0.17, W * 0.86, cx + W * 0.17, W * 0.86 + lw), radius=lw / 2, fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)


def current_name():
    try:
        src = open(os.path.join(ROOT, "utils", "agent.js")).read()
        return re.search(r"name: '([^']*)'", src).group(1)
    except Exception:
        return "Hermes"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default=None)
    ap.add_argument("--photo", default=None)
    ap.add_argument("--crop", default=None)
    a = ap.parse_args()
    name = (a.name or current_name()).strip()
    face = (lambda s: photo_face(a.photo, a.crop, s)) if a.photo else (lambda s: initials_face(name, s))

    for shape, k in SHAPES.items():
        out = os.path.join(ROOT, "assets", "default." + shape)
        os.makedirs(out, exist_ok=True)
        face(248).save(os.path.join(out, "icon.png"))
        face(round(44 * k)).save(os.path.join(out, "avatar.png"))
        tail(round(14 * k), round(18 * k), GRAY, False).save(os.path.join(out, "tail-in.png"))
        tail(round(14 * k), round(18 * k), BLUE, True).save(os.path.join(out, "tail-out.png"))
        mic(round(30 * k)).save(os.path.join(out, "mic.png"))

    buf = io.BytesIO()
    face(96).save(buf, format="PNG")
    with open(os.path.join(ROOT, "setting", "avatar.js"), "w") as f:
        f.write("// Generated by tools/gen-assets.py: the agent's avatar as a base64 PNG.\n")
        f.write("export const AVATAR = 'data:image/png;base64," + base64.b64encode(buf.getvalue()).decode() + "'\n")

    with open(os.path.join(ROOT, "utils", "agent.js"), "w") as f:
        f.write("// Generated by tools/gen-assets.py. The default agent name; the Settings App can override it.\n")
        f.write("export const AGENT = { name: '" + name.replace("'", "\\'") + "' }\n")

    p = os.path.join(ROOT, "app.json")
    app = json.load(open(p))
    app["app"]["appName"] = name
    for lang in app.get("i18n", {}).values():
        lang["appName"] = name
    with open(p, "w") as f:
        json.dump(app, f, indent=2)
        f.write("\n")

    os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
    face(160).save(os.path.join(ROOT, "docs", "icon.png"))
    print("assets written for", repr(name), "(photo)" if a.photo else "(initials)")


if __name__ == "__main__":
    main()
