# Clickaton — Photography Guidelines

Complemento operativo de [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) § Sistema fotográfico.

## Objetivo

Las fotos cuentan ciudad, competencia, aprendizaje y comunidad. No compiten con tipografía ni con el amarillo de marca.

## Proporción

~70% superficies oscuras · ~20% fotografía · ~10% acento amarillo.

## Assets

| Regla | Detalle |
|-------|---------|
| Origen | Solo archivos locales controlados (`public/…`) |
| Prohibido | Unsplash/Pexels/remotos, IA como “documental real” |
| Créditos | Solo si existen; nunca inventar autores |
| Registro mínimo | `{ src, alt, credit?, source? }` |

## Variantes (`PhotoFrame`)

`hero` · `editorial` · `card` · `gallery` · `portrait` · `jury` · `sponsor-feature` · `background` · `thumbnail`

Presets: `apps/clickaton/lib/photography.ts`.

## Overlays

Solo negros (`soft` / `medium` / `strong`). Nunca overlay amarillo dominante.

## Fallback

Composición abstracta (gradiente + grilla + FocusMark). Sin textos “placeholder” / “pendiente” visibles al visitante.

## Checklist al sumar una foto

1. Archivo local optimizado (WebP/AVIF o PNG/JPEG liviano).
2. `alt` descriptivo (o `decorative` si no informa).
3. Crédito real o omitido.
4. Variante correcta + `sizes`.
5. `priority` solo above-the-fold.
6. Contraste del texto sobre overlay verificado en mobile.
7. Showroom `/design-system` actualizado si hay nuevo patrón.

## Logo

- Original: `logo-horizontal.png` (~476KB, 1200px).
- UI: `logo-horizontal-web.png` (~341KB, 960px) — misma composición, menor peso.
