# Info Spot — Brand assets (PNG)

**Fecha de integración:** 2026-07-10  
**Actualización PASO 9:** 2026-07-11 — PNG oficiales restaurados como fuente de verdad en UI.  
**Ubicación:** `apps/infospot/public/brand/`

## Formato activo

| Superficie | Asset activo |
| --- | --- |
| Header / footer | `/brand/infospot-logo-horizontal.png` |
| Mobile nav (isotipo) | `/brand/infospot-isotipo.png` |
| Favicon | `/brand/infospot-favicon.png` (+ `app/icon.png`) |
| Apple touch | `app/apple-icon.png` |
| Open Graph default | `/brand/og-default.png` |
| JSON-LD logo | horizontal PNG (o `InfoSpotSettings.logoUrl`) |

**Legacy (no usar en UI):** `/infospot-logo.svg`, `/infospot-mark.svg` — se conservan en disco por si hay referencias externas; no son la fuente de verdad.

## Archivos

| Archivo | Uso | Dimensiones (post-crop) |
| --- | --- | --- |
| `infospot-logo-horizontal.png` | Header / footer (fondos claros) | 942 × 373 |
| `infospot-logo-positive.png` | Alias de horizontal para fondos claros | 942 × 373 |
| `infospot-isotipo.png` | Nav móvil, compactos | 707 × 789 |
| `infospot-favicon.png` | Favicon / apple-touch | 707 × 789 |
| `infospot-logo-negative.png` | Isotipo mono claro — **solo fondos oscuros** | 428 × 461 |
| `og-default.png` | Open Graph fallback | 1200 × 630 |

También:

- `apps/infospot/app/icon.png` (32 × 32)
- `apps/infospot/app/apple-icon.png` (180 × 180)

## Procesamiento aplicado

Los PNG de origen venían en RGB **sin alpha** y con fondo negro de exportación.

1. Se removió el fondo negro → transparencia (sin recolorear el logo).
2. Se recortó padding vacío para mejor nitidez a tamaño UI.
3. El archivo `positive` original era casi negro-sobre-negro (inutilizable en UI clara); se alineó a la versión **horizontal color** como positive oficial para fondos claros.

## Tokens de color (muestreo del logo)

| Rol | Token | Hex |
| --- | --- | --- |
| Naranja marca | `--is-orange-500` / `--is-accent` | `#f86000` |
| Naranja hover | `--is-orange-600` / `--is-accent-hover` | `#d95500` |
| Grafito marca | `--is-graphite-800` / `--is-text` | `#203038` |
| Grafito oscuro | `--is-graphite-900` | `#182028` |

## Variantes `BrandMark`

| Variant | Asset | Contexto |
| --- | --- | --- |
| `horizontal` | horizontal.png | SiteHeader, SiteFooter |
| `positive` | positive.png | Fondos claros (mismo lockup) |
| `isotipo` | isotipo.png | MobileNavigation panel |
| `compact` | isotipo.png (más chico) | Espacios densos |
| `negative` | negative.png | Solo fondos oscuros puntuales |

## Reglas

- No deformar (`object-contain` + `w-auto`).
- No recrear con texto HTML.
- No recolorear PNG.
- Experiencia predominantemente clara.
- `negative` nunca sobre blanco/gris claro.
