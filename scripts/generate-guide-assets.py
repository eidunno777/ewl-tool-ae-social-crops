#!/usr/bin/env python3
"""
Social Crops — Guide Asset Generator
Generates 6 guide images for the Social Crops After Effects panel.

Outputs written to ../images/ relative to this script.

Usage (from repo root):
    pip install pillow
    python scripts/generate-guide-assets.py

Requires: Pillow >= 8.2
"""
import os
import math
from PIL import Image, ImageDraw

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "images"))

# Canvas size matches all existing guide assets
CW, CH = 1080, 1920

# Consistent horizontal inset so all guides match the reels/tiktok look
MARGIN_X = 44
BOX_W = CW - 2 * MARGIN_X   # 992 px

BORDER_PX = 2
HANDLE_PX = 12   # corner square half-size = 6


# ── Palette ───────────────────────────────────────────────────────────────────

# Instagram Feed crop guide — brand magenta
IG_BG      = (252, 228, 240, 255)
IG_ACCENT  = (193,  53, 132, 255)

# Generic aspect-ratio guides — neutral slate blue (not brand-tied)
SLATE_BG     = (225, 236, 244, 255)
SLATE_ACCENT = ( 72, 118, 155, 255)


# ── Helpers ───────────────────────────────────────────────────────────────────

def new_canvas(bg_rgba):
    return Image.new("RGBA", (CW, CH), bg_rgba)


def draw_safe_box(img, accent_rgba, bx, by, bw, bh):
    """Transparent safe-zone cutout with coloured border + corner-handle squares.

    The interior of the safe-zone box is punched out to full transparency so
    the AE comp content underneath shows through; only the margin background,
    border line, and handle squares remain visible.
    """
    x1, y1, x2, y2 = bx, by, bx + bw, by + bh

    # Punch the safe-zone interior out to transparent
    transparent = Image.new("RGBA", (bw + 1, bh + 1), (0, 0, 0, 0))
    img.paste(transparent, (bx, by))

    # Coloured outline and handles drawn on top (fully opaque)
    draw = ImageDraw.Draw(img)
    a = accent_rgba[:3] + (255,)
    draw.rectangle([x1, y1, x2, y2], outline=a, width=BORDER_PX)

    # Corner handle squares (drawn on top of border)
    h = HANDLE_PX // 2
    for cx, cy in [(x1, y1), (x2, y1), (x1, y2), (x2, y2)]:
        draw.rectangle([cx - h, cy - h, cx + h, cy + h], fill=a)


def vcentre(box_h):
    """Return the y-offset that vertically centres box_h in the canvas."""
    return (CH - box_h) // 2


def save_png(img, name):
    """Save an RGBA image as PNG, preserving the alpha channel."""
    path = os.path.join(OUT_DIR, name)
    img.save(path, "PNG")
    print(f"  {name}")


# ── Crop guide factory ────────────────────────────────────────────────────────

def make_crop(name, bg_rgba, accent_rgba, ratio_w, ratio_h):
    bh = round(BOX_W * ratio_h / ratio_w)
    by = vcentre(bh)
    img = new_canvas(bg_rgba)
    draw_safe_box(img, accent_rgba, MARGIN_X, by, BOX_W, bh)
    save_png(img, name)


# ── Instagram Feed UI overlay ─────────────────────────────────────────────────

def _c(rgb, a=22):
    """Pack an RGB tuple with alpha."""
    return rgb + (a,)


def draw_ig_feed_overlay(name):
    """
    Schematic Instagram Feed chrome at ~9% opacity on a transparent canvas.
    The 4:5 post image area (matching instagram-feed-crop.png) is left blank/transparent.
    """
    img = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    PINK = (193, 53, 132)
    GRAY = (120, 120, 120)
    A = 24    # main chrome alpha (~9 %)
    A_LO = 16  # lighter placeholder text (~6 %)

    # Image area geometry (matches make_crop for 4:5)
    bh = round(BOX_W * 5 / 4)   # 1240
    feed_top = vcentre(bh)       # 340
    feed_bot = feed_top + bh     # 1580

    # ── Stories / header row ──────────────────────────────────────────
    # "Feed" text placeholder
    d.rectangle([80, 28, 220, 50], fill=_c(GRAY, A_LO))
    # Camera icon placeholder (top-right)
    d.rectangle([CW - 100, 26, CW - 60, 58], fill=_c(GRAY, A_LO))
    # Separator below header
    d.line([(0, 68), (CW, 68)], fill=_c(GRAY, A_LO), width=1)

    # ── Story bubbles row ─────────────────────────────────────────────
    SB_Y, SB_R = 140, 38
    for i in range(5):
        sx = 80 + i * 180
        d.ellipse([sx - SB_R, SB_Y - SB_R, sx + SB_R, SB_Y + SB_R],
                  outline=_c(PINK, A), width=2)
        # Username bar below each bubble
        d.rectangle([sx - 30, SB_Y + SB_R + 8, sx + 30, SB_Y + SB_R + 22],
                    fill=_c(GRAY, A_LO))

    d.line([(0, feed_top - 6), (CW, feed_top - 6)],
           fill=_c(GRAY, A_LO), width=1)

    # (Post image area feed_top → feed_bot is intentionally left white)

    # ── Action icons row ──────────────────────────────────────────────
    ICON_Y = feed_bot + 36
    IR = 22   # icon radius

    # Heart — two small circles + downward tip
    hx = 60
    d.ellipse([hx - IR, ICON_Y - IR // 2, hx, ICON_Y + IR // 2],
              outline=_c(PINK, A), width=2)
    d.ellipse([hx, ICON_Y - IR // 2, hx + IR, ICON_Y + IR // 2],
              outline=_c(PINK, A), width=2)
    d.polygon(
        [(hx - IR + 5, ICON_Y + 6), (hx + IR - 5, ICON_Y + 6), (hx, ICON_Y + IR + 8)],
        outline=_c(PINK, A),
    )

    # Comment bubble
    cbx = 60 + 96
    d.ellipse([cbx - IR, ICON_Y - IR, cbx + IR, ICON_Y + IR],
              outline=_c(GRAY, A), width=2)
    d.polygon(
        [(cbx - 12, ICON_Y + IR - 4), (cbx - 28, ICON_Y + IR + 16), (cbx + 4, ICON_Y + IR - 2)],
        outline=_c(GRAY, A),
    )

    # Send arrow (triangle)
    sx = 60 + 192
    d.polygon(
        [(sx - IR, ICON_Y + IR), (sx + IR, ICON_Y - IR),
         (sx + IR, ICON_Y + IR // 2)],
        outline=_c(GRAY, A),
    )

    # Bookmark (right side)
    bkx = CW - 56
    d.rectangle([bkx - 14, ICON_Y - IR, bkx + 14, ICON_Y + IR],
                outline=_c(GRAY, A), width=2)
    # Transparent notch at bottom of bookmark (cuts back to transparent)
    d.polygon(
        [(bkx - 14, ICON_Y + IR - 10), (bkx, ICON_Y + IR - 22), (bkx + 14, ICON_Y + IR - 10)],
        fill=(0, 0, 0, 0),
    )

    # Three-dot more button
    for di in range(3):
        dx = CW - 170 + di * 22
        d.ellipse([dx - 3, ICON_Y - 3, dx + 3, ICON_Y + 3], fill=_c(GRAY, A_LO))

    # ── Caption / metadata ────────────────────────────────────────────
    CY = ICON_Y + 54
    d.rectangle([44, CY, 200, CY + 18], fill=_c(GRAY, A_LO))           # likes count
    d.rectangle([44, CY + 28, 460, CY + 46], fill=_c(GRAY, A))         # user + caption l1
    d.rectangle([44, CY + 54, 540, CY + 72], fill=_c(GRAY, A_LO))      # caption l2
    d.rectangle([44, CY + 80, 320, CY + 98], fill=_c(GRAY, A_LO))      # caption l3
    d.rectangle([44, CY + 110, 350, CY + 126], fill=_c(GRAY, A_LO - 6))  # view comments
    d.rectangle([44, CY + 140, 190, CY + 154], fill=_c(GRAY, A_LO - 8))  # timestamp

    # ── Bottom nav bar ────────────────────────────────────────────────
    NAV_Y = CH - 110
    d.line([(0, NAV_Y), (CW, NAV_Y)], fill=_c(GRAY, A_LO), width=1)
    for ni, nx in enumerate([108, 270, 540, 810, 972]):
        d.ellipse([nx - 20, NAV_Y + 18, nx + 20, NAV_Y + 58],
                  outline=_c(GRAY, A_LO), width=2)

    save_png(img, name)


# ── Entry point ───────────────────────────────────────────────────────────────

# ── Platform UI icons (32×32 px, RGBA) ────────────────────────────────────────

def _font(size, bold=False):
    """Return a Pillow font, trying common Windows / macOS / Linux paths."""
    from PIL import ImageFont
    candidates = (
        [r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf",
         "/System/Library/Fonts/Helvetica.ttc",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
        if bold else
        [r"C:\Windows\Fonts\arial.ttf",
         "/System/Library/Fonts/Helvetica.ttc",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    )
    for p in candidates:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()


def _draw_icon(bg_rgba, text, text_rgba=(255, 255, 255, 255),
               radius=7, size=32, bold=True, font_size=14):
    """32×32 rounded-square icon with centred text."""
    from PIL import ImageFont
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Rounded rect background via mask
    bg = Image.new("RGBA", (size, size), bg_rgba)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=radius, fill=255)
    img.paste(bg, mask=mask)
    d = ImageDraw.Draw(img)
    fnt = _font(font_size, bold=bold)
    try:
        bb = d.textbbox((0, 0), text, font=fnt)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
    except AttributeError:                      # older Pillow
        tw, th = d.textsize(text, font=fnt)
    d.text(((size - tw) // 2, (size - th) // 2 - 1),
           text, fill=text_rgba, font=fnt)
    return img


def _gradient_icon(top_rgba, bot_rgba, text, text_rgba=(255, 255, 255, 255),
                   radius=7, size=32, bold=True, font_size=14):
    """Vertical-gradient rounded-square icon."""
    from PIL import ImageFont
    # Build gradient
    grad = Image.new("RGBA", (size, size))
    for y in range(size):
        t = y / (size - 1)
        px = tuple(int(top_rgba[i] * (1 - t) + bot_rgba[i] * t) for i in range(4))
        for x in range(size):
            grad.putpixel((x, y), px)
    # Mask to rounded rect
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=radius, fill=255)
    img.paste(grad, mask=mask)
    # Text
    d = ImageDraw.Draw(img)
    fnt = _font(font_size, bold=bold)
    try:
        bb = d.textbbox((0, 0), text, font=fnt)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
    except AttributeError:
        tw, th = d.textsize(text, font=fnt)
    d.text(((size - tw) // 2, (size - th) // 2 - 1),
           text, fill=text_rgba, font=fnt)
    return img


def make_platform_icons():
    # LinkedIn — brand blue
    save_png(_draw_icon((10, 102, 194, 255), "in", radius=4), "icon-linkedin.png")
    # Instagram — purple → golden-orange gradient
    save_png(_gradient_icon((131, 52, 175, 255), (252, 175, 69, 255), "IG",
                            radius=7), "icon-instagram.png")
    # TikTok — black square
    save_png(_draw_icon((0, 0, 0, 255), "TT", radius=7), "icon-tiktok.png")
    print("  icon-linkedin.png")
    print("  icon-instagram.png")
    print("  icon-tiktok.png")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Writing to {OUT_DIR}\n")

    # Instagram Feed
    make_crop("instagram-feed-crop.png", IG_BG, IG_ACCENT, 4, 5)
    draw_ig_feed_overlay("instagram-feed-overlay.png")

    # Aspect-ratio guides (all use neutral slate palette)
    make_crop("ratio-1x1-crop.png",  SLATE_BG, SLATE_ACCENT, 1,  1)
    make_crop("ratio-4x5-crop.png",  SLATE_BG, SLATE_ACCENT, 4,  5)
    make_crop("ratio-9x16-crop.png", SLATE_BG, SLATE_ACCENT, 9, 16)
    make_crop("ratio-16x9-crop.png", SLATE_BG, SLATE_ACCENT, 16, 9)

    # Platform icons
    make_platform_icons()

    print("\nDone.")


if __name__ == "__main__":
    main()
