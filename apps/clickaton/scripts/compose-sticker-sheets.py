#!/usr/bin/env python3
"""Planchas de stickers estilo animado para fotógrafos — logos oficiales Clickatón."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "images" / "founding-allies"
BRAND = ROOT / "public" / "brand"
REFS = DEST / "refs"

YELLOW = (255, 196, 0, 255)
BLACK = (17, 17, 17, 255)
WHITE = (255, 255, 255, 255)
GRAY = (185, 185, 185, 255)
SHEET_BG = (245, 243, 238, 255)


def load_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def knock_out_black(img: Image.Image, threshold: int = 22) -> Image.Image:
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and r <= threshold and g <= threshold and b <= threshold:
                px[x, y] = (r, g, b, 0)
    return img


def fit_width(img: Image.Image, width: int) -> Image.Image:
    w, h = img.size
    return img.resize((max(1, width), max(1, int(h * width / w))), Image.Resampling.LANCZOS)


def content_crop(img: Image.Image) -> Image.Image:
    bbox = img.split()[-1].getbbox()
    return img.crop(bbox) if bbox else img


def make_sticker(img: Image.Image, border: int = 18, shadow: bool = True) -> Image.Image:
    """Envuelve un graphic en borde blanco die-cut + sombra suave."""
    img = content_crop(img)
    pad = border + (10 if shadow else 0)
    canvas = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))

    # Máscara expandida para el borde blanco
    alpha = img.split()[-1]
    mask = Image.new("L", img.size, 0)
    mask.paste(alpha, (0, 0))
    # Dilatar borde
    for _ in range(border // 2):
        mask = mask.filter(ImageFilter.MaxFilter(5))

    white_layer = Image.new("RGBA", img.size, WHITE)
    sticker_body = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sticker_body.paste(white_layer, mask=mask)
    sticker_body.alpha_composite(img)

    ox = pad
    oy = pad
    if shadow:
        sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        shadow_mask = Image.new("L", sticker_body.size, 0)
        shadow_mask.paste(sticker_body.split()[-1], (0, 0))
        shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(6))
        shadow_img = Image.new("RGBA", sticker_body.size, (0, 0, 0, 70))
        sh.paste(shadow_img, (ox + 4, oy + 6), shadow_mask)
        canvas = Image.alpha_composite(canvas, sh)

    canvas.alpha_composite(sticker_body, (ox, oy))
    return canvas


def draw_aperture_sticker(size: int = 280) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = size // 2
    r = size // 2 - 8
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=BLACK)
    d.ellipse((cx - r + 14, cy - r + 14, cx + r - 14, cy + r - 14), outline=YELLOW, width=8)
    # Hojas de diafragma simplificadas
    for i in range(6):
        ang = math.radians(i * 60)
        x1 = cx + int(math.cos(ang) * (r - 40))
        y1 = cy + int(math.sin(ang) * (r - 40))
        x2 = cx + int(math.cos(ang + 0.7) * (r - 18))
        y2 = cy + int(math.sin(ang + 0.7) * (r - 18))
        d.polygon([(cx, cy), (x1, y1), (x2, y2)], fill=YELLOW)
    d.ellipse((cx - 28, cy - 28, cx + 28, cy + 28), fill=BLACK)
    d.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill=YELLOW)
    return img


def draw_flash_sticker(size: int = 220) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Rayo
    bolt = [
        (size * 0.55, size * 0.08),
        (size * 0.28, size * 0.48),
        (size * 0.48, size * 0.48),
        (size * 0.38, size * 0.92),
        (size * 0.72, size * 0.42),
        (size * 0.52, size * 0.42),
    ]
    d.polygon(bolt, fill=YELLOW)
    # Contorno negro grueso estilo cartoon
    d.line(bolt + [bolt[0]], fill=BLACK, width=6, joint="curve")
    return img


def draw_shutter_sticker(size: int = 240) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = size // 2
    r = size // 2 - 6
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=YELLOW)
    d.ellipse((cx - r + 10, cy - r + 10, cx + r - 10, cy + r - 10), fill=BLACK)
    # Triángulos de obturador
    for i in range(8):
        a0 = math.radians(i * 45 - 90)
        a1 = math.radians(i * 45 + 18 - 90)
        pts = [
            (cx, cy),
            (cx + int(math.cos(a0) * (r - 18)), cy + int(math.sin(a0) * (r - 18))),
            (cx + int(math.cos(a1) * (r - 18)), cy + int(math.sin(a1) * (r - 18))),
        ]
        d.polygon(pts, fill=WHITE if i % 2 == 0 else GRAY)
    d.ellipse((cx - 22, cy - 22, cx + 22, cy + 22), fill=YELLOW)
    return img


def draw_text_bubble(text: str, fill=YELLOW, ink=BLACK, w: int = 320, h: int = 120) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((4, 4, w - 4, h - 4), radius=28, fill=fill, outline=BLACK, width=6)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 42)
    except OSError:
        font = ImageFont.load_default()
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((w - tw) / 2, (h - th) / 2 - 4), text, font=font, fill=ink)
    return img


def place(sheet: Image.Image, sticker: Image.Image, x: int, y: int, scale: float = 1.0, angle: float = 0) -> None:
    s = sticker
    if scale != 1.0:
        nw = max(1, int(s.width * scale))
        nh = max(1, int(s.height * scale))
        s = s.resize((nw, nh), Image.Resampling.LANCZOS)
    if angle:
        s = s.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    sheet.alpha_composite(s, (int(x), int(y)))


def build_sheet_a() -> Image.Image:
    """Plancha principal: isologotipo + logo horizontal + iconos foto."""
    W, H = 1600, 1600
    sheet = Image.new("RGBA", (W, H), SHEET_BG)
    d = ImageDraw.Draw(sheet)
    # Margen punteado tipo plancha
    d.rounded_rectangle((40, 40, W - 40, H - 40), radius=24, outline=(200, 198, 190, 255), width=3)

    iso = knock_out_black(load_rgba(REFS / "isologotipo.png"))
    logo_h = content_crop(load_rgba(BRAND / "logo-horizontal-color.png"))

    s_iso = make_sticker(fit_width(iso, 420), border=22)
    s_logo = make_sticker(fit_width(logo_h, 620), border=16)
    s_ap = make_sticker(draw_aperture_sticker(260), border=14)
    s_flash = make_sticker(draw_flash_sticker(200), border=14)
    s_shut = make_sticker(draw_shutter_sticker(220), border=14)
    s_click = make_sticker(draw_text_bubble("¡CLICK!", YELLOW, BLACK, 300, 110), border=10)
    s_mira = make_sticker(draw_text_bubble("MIRÁ", BLACK, YELLOW, 260, 100), border=10)
    s_foto = make_sticker(draw_text_bubble("FOTO", WHITE, BLACK, 240, 96), border=10)

    # Composición animada, rotaciones suaves
    place(sheet, s_iso, 120, 160, 1.0, -6)
    place(sheet, s_logo, 720, 180, 1.0, 4)
    place(sheet, s_ap, 180, 780, 1.0, 8)
    place(sheet, s_flash, 560, 720, 1.0, -12)
    place(sheet, s_shut, 900, 780, 1.0, 10)
    place(sheet, s_click, 1180, 560, 1.0, -8)
    place(sheet, s_mira, 200, 1200, 1.0, 5)
    place(sheet, s_foto, 700, 1180, 1.0, -4)
    # Mini isologo abajo derecha
    place(sheet, make_sticker(fit_width(iso, 260), border=16), 1100, 1120, 1.0, 12)

    return sheet


def build_sheet_b() -> Image.Image:
    """Segunda plancha: más densa, pack fotógrafo."""
    W, H = 1600, 1600
    sheet = Image.new("RGBA", (W, H), (18, 18, 18, 255))
    d = ImageDraw.Draw(sheet)
    d.rounded_rectangle((36, 36, W - 36, H - 36), radius=20, outline=YELLOW, width=4)

    iso = knock_out_black(load_rgba(REFS / "isologotipo.png"))
    logo_h = content_crop(load_rgba(BRAND / "logo-horizontal-color.png"))

    stickers = [
        (make_sticker(fit_width(logo_h, 700), border=18), 420, 120, 0, 3),
        (make_sticker(fit_width(iso, 380), border=20), 140, 380, 1.0, -8),
        (make_sticker(draw_aperture_sticker(240), border=12), 720, 420, 1.0, 14),
        (make_sticker(draw_flash_sticker(180), border=12), 1100, 380, 1.0, -16),
        (make_sticker(draw_shutter_sticker(200), border=12), 1280, 700, 1.0, 6),
        (make_sticker(draw_text_bubble("DISPARÁ", YELLOW, BLACK, 340, 110), border=10), 180, 980, 1.0, 4),
        (make_sticker(draw_text_bubble("ENFOCÁ", BLACK, WHITE, 300, 100), border=10), 700, 920, 1.0, -5),
        (make_sticker(draw_text_bubble("¡CLICK!", YELLOW, BLACK, 280, 100), border=10), 1120, 1080, 1.0, 9),
        (make_sticker(fit_width(iso, 220), border=14), 520, 1200, 1.0, -10),
        (make_sticker(draw_aperture_sticker(160), border=10), 900, 1220, 1.0, 18),
    ]
    for s, x, y, _sc, ang in stickers:
        place(sheet, s, x, y, 1.0, ang)

    return sheet


def save_jpg(img: Image.Image, path: Path) -> None:
    rgb = Image.new("RGB", img.size, (245, 243, 238))
    rgb.paste(img, mask=img.split()[-1])
    path.parent.mkdir(parents=True, exist_ok=True)
    rgb.save(path, "JPEG", quality=92, optimize=True)
    print(f"wrote {path.name} ({path.stat().st_size // 1024} KB)")


def main() -> None:
    save_jpg(build_sheet_a(), DEST / "sticker-sheet-a.jpg")
    save_jpg(build_sheet_b(), DEST / "sticker-sheet-b.jpg")
    # Reemplazar pin-sticker suelto por plancha A como preview premium
    print("done")


if __name__ == "__main__":
    main()
