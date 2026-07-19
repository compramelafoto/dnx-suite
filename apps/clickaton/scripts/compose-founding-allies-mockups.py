#!/usr/bin/env python3
"""Compone mockups Aliados Fundadores con logos oficiales (fondo transparente).

Preferir `logo-horizontal-color.png` (ya con alpha).
Para isologotipo con fondo negro: knock-out de negros.
Sin escenario ni cajas de bienvenida.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "images" / "founding-allies"
BRAND = ROOT / "public" / "brand"
ASSETS = Path(
    "/Users/danielcuart/.cursor/projects/Users-danielcuart-Desktop-PROGRAMACIONES-dnx-suite/assets"
)
REFS = DEST / "refs"

LOGO_H = BRAND / "logo-horizontal-color.png"
LOGO_ISO = REFS / "isologotipo.png"


def load_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def fit_width(img: Image.Image, width: int) -> Image.Image:
    w, h = img.size
    if w == 0:
        return img
    ratio = width / w
    return img.resize((max(1, width), max(1, int(h * ratio))), Image.Resampling.LANCZOS)


def knock_out_black(img: Image.Image, threshold: int = 22) -> Image.Image:
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and r <= threshold and g <= threshold and b <= threshold:
                px[x, y] = (r, g, b, 0)
    return img


def clean_dark_halo(img: Image.Image, luma_max: int = 40) -> Image.Image:
    """Quita halo oscuro semitransparente; conserva amarillo y blanco de marca."""
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r > 180 and g > 140 and b < 80:
                continue
            if r > 200 and g > 200 and b > 200:
                continue
            luma = (r + g + b) / 3
            if luma <= luma_max or (luma < 70 and a < 220):
                px[x, y] = (0, 0, 0, 0)
    return img


def paste(
    base: Image.Image,
    logo: Image.Image,
    *,
    cx_ratio: float,
    cy_ratio: float,
    max_width_ratio: float,
) -> Image.Image:
    out = base.copy()
    mark = fit_width(logo, int(out.width * max_width_ratio))
    lx = int(out.width * cx_ratio - mark.width / 2)
    ly = int(out.height * cy_ratio - mark.height / 2)
    out.alpha_composite(mark, (lx, ly))
    return out


def save_jpg(img: Image.Image, path: Path, quality: int = 92) -> None:
    rgb = Image.new("RGB", img.size, (236, 236, 236))
    rgb.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
    path.parent.mkdir(parents=True, exist_ok=True)
    rgb.save(path, "JPEG", quality=quality, optimize=True)
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


def main() -> None:
    logo_h = load_rgba(LOGO_H)
    logo_iso = knock_out_black(load_rgba(LOGO_ISO))

    # Remeras oficiales del usuario
    save_jpg(load_rgba(REFS / "example-tee-front.png"), DEST / "tee-men.jpg")
    save_jpg(load_rgba(REFS / "example-tee-back-sponsors.png"), DEST / "tee-back-allies.jpg")

    save_jpg(
        paste(load_rgba(ASSETS / "blank-tee-women-v2.jpg"), logo_h, cx_ratio=0.5, cy_ratio=0.36, max_width_ratio=0.48),
        DEST / "tee-women.jpg",
    )
    # Gorra: logo horizontal oficial con fondo transparente
    cap = load_rgba(ASSETS / "blank-cap-v2.jpg")
    cap_mark = logo_h
    cap_bbox = cap_mark.split()[-1].getbbox()
    if cap_bbox:
        cap_mark = cap_mark.crop(cap_bbox)
    cap_logo = fit_width(cap_mark, int(cap.width * 0.52))
    cap.alpha_composite(
        cap_logo,
        ((cap.width - cap_logo.width) // 2, int(cap.height * 0.42 - cap_logo.height / 2)),
    )
    save_jpg(cap, DEST / "cap.jpg")
    save_jpg(
        paste(load_rgba(ASSETS / "blank-credential-v2.jpg"), logo_h, cx_ratio=0.5, cy_ratio=0.32, max_width_ratio=0.52),
        DEST / "credential.jpg",
    )

    # Roll up: logo horizontal transparente (sin caja), centrado en la cara
    roll = load_rgba(ASSETS / "blank-rollup.jpg")
    roll_mark = clean_dark_halo(logo_h.copy())
    roll_bbox = roll_mark.split()[-1].getbbox()
    if roll_bbox:
        x0, y0, x1, y1 = roll_bbox
        roll_mark = roll_mark.crop((max(0, x0 - 4), max(0, y0 - 4), x1 + 4, y1 + 4))
    roll_logo = fit_width(roll_mark, int(roll.width * 0.52))
    roll.alpha_composite(
        roll_logo,
        ((roll.width - roll_logo.width) // 2, int(roll.height * 0.34 - roll_logo.height / 2)),
    )
    save_jpg(roll, DEST / "rollup.jpg")

    save_jpg(
        paste(load_rgba(ASSETS / "blank-banner.jpg"), logo_h, cx_ratio=0.5, cy_ratio=0.5, max_width_ratio=0.42),
        DEST / "banner.jpg",
    )
    save_jpg(
        paste(load_rgba(ASSETS / "blank-stand.jpg"), logo_h, cx_ratio=0.5, cy_ratio=0.18, max_width_ratio=0.26),
        DEST / "stand.jpg",
    )
    # Bolso: logo horizontal centrado en la cara
    tote = load_rgba(ASSETS / "blank-tote.jpg")
    tote_mark = logo_h
    tote_bbox = tote_mark.split()[-1].getbbox()
    if tote_bbox:
        tote_mark = tote_mark.crop(tote_bbox)
    tote_logo = fit_width(tote_mark, int(tote.width * 0.42))
    # Centro óptico del panel (mockup 3/4)
    tote.alpha_composite(
        tote_logo,
        (
            int(tote.width * 0.52 - tote_logo.width / 2),
            int(tote.height * 0.52 - tote_logo.height / 2),
        ),
    )
    save_jpg(tote, DEST / "tote.jpg")
    save_jpg(
        paste(load_rgba(ASSETS / "blank-accreditation.jpg"), logo_h, cx_ratio=0.5, cy_ratio=0.20, max_width_ratio=0.28),
        DEST / "accreditation.jpg",
    )
    # Carpa: logo horizontal centrado en el back
    tent = load_rgba(ASSETS / "blank-tent.jpg")
    tent_mark = logo_h
    tent_bbox = tent_mark.split()[-1].getbbox()
    if tent_bbox:
        tent_mark = tent_mark.crop(tent_bbox)
    tent_logo = fit_width(tent_mark, int(tent.width * 0.34))
    tent.alpha_composite(
        tent_logo,
        ((tent.width - tent_logo.width) // 2, int(tent.height * 0.42 - tent_logo.height / 2)),
    )
    save_jpg(tent, DEST / "tent-back.jpg")
    # Kit: logo oficial centrado (recorte al contenido para evitar padding asimétrico)
    kit = load_rgba(ASSETS / "blank-kit-v2.jpg")
    kit_mark = logo_h
    content = kit_mark.split()[-1].getbbox()
    if content:
        kit_mark = kit_mark.crop(content)
    kit_logo = fit_width(kit_mark, int(kit.width * 0.38))
    # Centro + leve corrección óptica (la cámara pesa a la izquierda del wordmark)
    kit.alpha_composite(
        kit_logo,
        (
            (kit.width - kit_logo.width) // 2 + int(kit.width * 0.02),
            (kit.height - kit_logo.height) // 2,
        ),
    )
    save_jpg(kit, DEST / "kit.jpg")

    pin = Image.new("RGBA", (1200, 1200), (17, 17, 17, 255))
    iso = fit_width(logo_iso, 700)
    pin.alpha_composite(iso, ((1200 - iso.width) // 2, (1200 - iso.height) // 2 - 20))
    save_jpg(pin, DEST / "pin-sticker.jpg")

    save_jpg(load_rgba(ASSETS / "hero-v2.jpg"), DEST / "hero.jpg", quality=90)

    # Asegurar que no queden assets descartados
    for obsolete in ("stage.jpg", "welcome-box.jpg", "podium.jpg"):
        path = DEST / obsolete
        if path.exists():
            path.unlink()
            print(f"removed {obsolete}")

    print("done")


if __name__ == "__main__":
    main()
