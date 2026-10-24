"""Draw the widgets recorded by run.mjs into a PNG that approximates the watch screen.

Usage: python render.py <widgets.json> <out.png> [--full]
  --full  draw the whole scrollable page instead of the first screen.
Uses Noto Sans (the Zepp OS system font) from /tmp/sw-fonts.
"""
import json
import os
import sys
import textwrap

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FONT = "/tmp/sw-fonts/NotoSans-Regular.ttf"
SS = 2  # supersampling


def rgb(c, alpha=255):
    return ((c >> 16) & 255, (c >> 8) & 255, c & 255, alpha)


_fonts = {}


def font(size, path=None):
    """System font (Noto Sans), or a custom font from assets/default.s/<path>."""
    size = max(1, int(size * SS))
    f = os.path.join(ROOT, "assets", "default.s", path) if path else FONT
    if (f, size) not in _fonts:
        _fonts[(f, size)] = ImageFont.truetype(f, size)
    return _fonts[(f, size)]


def fit_lines(draw, text, f, w, mode):
    if "\n" in text:
        out = []
        for part in text.split("\n"):
            out += fit_lines(draw, part, f, w, mode)
        return out
    if mode == "wrap":
        words, lines, cur = text.split(" "), [], ""
        for word in words:
            trial = (cur + " " + word).strip()
            if draw.textlength(trial, font=f) <= w:
                cur = trial
                continue
            if cur:
                lines.append(cur)
                cur = ""
            for ch in word:  # a word wider than the box breaks between characters
                if cur and draw.textlength(cur + ch, font=f) > w:
                    lines.append(cur)
                    cur = ""
                cur += ch
        lines.append(cur)
        return lines
    if mode == "ellipsis" and draw.textlength(text, font=f) > w:
        while text and draw.textlength(text + "...", font=f) > w:
            text = text[:-1]
        return [text + "..."]
    return [text]


def draw_text(img, w, text, size, color, align_h="center", align_v="middle", mode="wrap", path=None):
    if not text:
        return
    x, y, bw, bh = (int(w.get(k, 0)) * SS for k in ("x", "y", "w", "h"))
    layer = Image.new("RGBA", (max(1, bw), max(1, bh)), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font(size, path)
    lines = fit_lines(d, str(text), f, bw, mode)
    lh = int(size * 1.16 * SS)
    total = lh * len(lines)
    ty = 0 if align_v == "top" else (bh - total if align_v == "bottom" else (bh - total) // 2)
    for line in lines:
        tw = d.textlength(line, font=f)
        tx = 0 if align_h == "left" else (bw - tw if align_h == "right" else (bw - tw) / 2)
        d.text((tx, ty + (lh - size * SS) / 2 - size * SS * 0.12), line, font=f, fill=color)
        ty += lh
    img.alpha_composite(layer, (x, y))


def asset(shape, src, scale):
    p = os.path.join(ROOT, "assets", "default." + shape, src)
    if not os.path.exists(p):
        return None
    im = Image.open(p).convert("RGBA")
    if scale != 1:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    return im.resize((im.width * SS, im.height * SS), Image.LANCZOS)


def render(data, full):
    dev = data["device"]
    W, H, shape = dev["width"], dev["height"], dev["shape"]
    scale = W / dev["dw"]
    widgets = data["widgets"]
    bottom = max([H] + [int(w.get("y", 0) + w.get("h", 0)) for w in widgets if "y" in w])
    CH = bottom if full else H
    img = Image.new("RGBA", (W * SS, CH * SS), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)

    for w in widgets:
        if w.get("_hidden"):
            continue
        t = w["type"]
        box = [w.get("x", 0) * SS, w.get("y", 0) * SS, (w.get("x", 0) + w.get("w", 0)) * SS, (w.get("y", 0) + w.get("h", 0)) * SS]
        if t == "FILL_RECT":
            d.rounded_rectangle(box, radius=w.get("radius", 0) * SS, fill=rgb(w["color"], w.get("alpha", 255)))
        elif t == "STROKE_RECT":
            d.rounded_rectangle(box, radius=w.get("radius", 0) * SS, outline=rgb(w["color"]), width=int(w.get("line_width", 1) * SS))
        elif t == "BUTTON":
            d.rounded_rectangle(box, radius=w.get("radius", 0) * SS, fill=rgb(w["normal_color"]))
            draw_text(img, w, w.get("text", ""), w.get("text_size", 30), rgb(w.get("color", 0xFFFFFF)), path=w.get("font"))
        elif t == "TEXT":
            draw_text(img, w, w.get("text", ""), w.get("text_size", 30), rgb(w.get("color", 0xFFFFFF)),
                      w.get("align_h", "left"), w.get("align_v", "top"), w.get("text_style", "none"), w.get("font"))
        elif t == "IMG":
            im = asset(shape, w["src"], scale)
            if im is not None:
                if "alpha" in w and w["alpha"] < 255:
                    a = im.getchannel("A").point(lambda v: v * max(w["alpha"], 160) // 255)
                    im.putalpha(a)
                img.alpha_composite(im, (int((w["x"] + w.get("pos_x", 0)) * SS), int((w["y"] + w.get("pos_y", 0)) * SS)))
        elif t == "ARC":
            if w["end_angle"] > w["start_angle"]:
                d.arc(box, w["start_angle"], w["end_angle"], fill=rgb(w["color"]), width=int(w["line_width"] * SS))
        elif t == "CIRCLE":
            cx, cy, r = w["center_x"] * SS, w["center_y"] * SS, w["radius"] * SS
            if w.get("alpha", 255) > 0:
                d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rgb(w["color"], w.get("alpha", 255)))
        elif t == "SLIDE_SWITCH":
            bg = asset(shape, w["select_bg"] if w.get("checked") else w["un_select_bg"], scale)
            knob = asset(shape, w["slide_src"], scale)
            img.alpha_composite(bg, (int(w["x"] * SS), int(w["y"] * SS)))
            kx = w["slide_select_x"] if w.get("checked") else w["slide_un_select_x"]
            img.alpha_composite(knob, (int((w["x"] + kx) * SS), int((w["y"] + w["slide_y"]) * SS)))
        elif t == "PAGE_INDICATOR":
            on, off = asset(shape, w["select_src"], scale), asset(shape, w["unselect_src"], scale)
            n, gap = 3, w.get("h_space", 8) * SS
            total = n * on.width + (n - 1) * gap
            x0 = int(w["x"] * SS + (w["w"] * SS - total) / 2)
            for i in range(n):
                img.alpha_composite(on if i == 0 else off, (x0 + i * (on.width + gap), int(w["y"] * SS)))

    if full:
        return img.resize((W, CH), Image.LANCZOS)

    # Screen shape and the square status bar.
    if shape == "s" and data["status"]["visible"]:
        d.rectangle((0, 0, W * SS, 64 * SS), fill=(0, 0, 0, 255))
        draw_text(img, {"x": 30, "y": 8, "w": 170, "h": 48}, data["status"]["title"], 34, (200, 200, 200, 255), "left", "middle", "ellipsis")
        draw_text(img, {"x": 190, "y": 8, "w": 172, "h": 48}, "10:30 PM", 34, (200, 200, 200, 255), "right", "middle", "none")
    mask = Image.new("L", (W * SS, H * SS), 0)
    md = ImageDraw.Draw(mask)
    if shape == "r":
        md.ellipse((0, 0, W * SS - 1, H * SS - 1), fill=255)
    else:
        md.rounded_rectangle((0, 0, W * SS - 1, H * SS - 1), radius=86 * SS * W / 390, fill=255)
    out = Image.new("RGBA", (W * SS, H * SS), (34, 34, 38, 255))
    out.paste(img.crop((0, 0, W * SS, H * SS)), (0, 0), mask)
    return out.resize((W, H), Image.LANCZOS)


if __name__ == "__main__":
    data = json.load(open(sys.argv[1]))
    render(data, "--full" in sys.argv).save(sys.argv[2])
