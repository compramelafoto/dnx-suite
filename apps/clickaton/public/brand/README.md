# Recursos de marca — Clickaton

**Fuente de verdad:** Manual de Marca oficial + lámina de variantes.

## Referencia

| Archivo | Uso |
|---------|-----|
| `manual-de-marca.png` | Manual completo (identidad, paleta, tipografía, iconografía, UI) |
| `logo-sheet.png` | Lámina de variantes del logo |

## Assets de uso en producto

Extraídos de la lámina oficial (no reinterpretados):

| Archivo | Uso |
|---------|-----|
| `logo-principal.png` | Logo stacked / sticker (fondos oscuros, hero) |
| `logo-vertical.png` | Vertical color (fondos claros) |
| `logo-horizontal.png` | Navbar / header (PNG oficial transparente) |
| `logo-horizontal-mono.png` | Horizontal monocromático |
| `logo-mono-negro.png` | Vertical monocromático |
| `isotipo.png` | Isotipo circular |
| `isotipo-amarillo.png` | Isotipo fondo amarillo |
| `isotipo-gris.png` | Isotipo fondo gris |
| `favicon-32.png` | Favicon 32×32 |
| `apple-touch-icon.png` | Apple touch 180×180 |
| `icon-512.png` / `social-avatar.png` | Avatar / PWA |
| `og-default.png` | Open Graph 1200×630 |

También en raíz `public/`:

| Archivo | Uso |
|---------|-----|
| `/favicon.png` · `/favicon.svg` | Favicon navegador |
| `/apple-touch-icon.png` | iOS home screen |
| `/og-default.png` | Thumbnail redes / compartir |

API en código:

- Rutas: `config/brand-assets.ts` (`brandAssetPaths` + `brandAssetUsage`)
- Componente: `components/brand/Logo.tsx` + `Wordmark.tsx`
- Metadata: `app/layout.tsx` + `lib/seo.ts`

### Uso por contexto

| Contexto | Variante |
|----------|----------|
| Hero Home | `principal` |
| Header | `horizontal` (Wordmark) |
| Footer oscuro | `horizontalMono` |
| Favicon | `/favicon.png` + `/brand/favicon-32.png` (lectura pequeña) |
| Open Graph | `/og-default.png` |

**Tipografía de producto (Manual):** Bebas Neue (display) · Montserrat (UI) · Caveat (acento editorial corto). El wordmark del logo **no** se tipografía.

## Reglas

1. **No modificar** el logo ni reconstruirlo tipográficamente.
2. **No** usar Bebas Neue / Montserrat para simular el wordmark del logo (el wordmark es asset gráfico).
3. Preferir SVG vectoriales definitivos cuando el estudio de marca los entregue; hasta entonces estos PNG son la referencia operativa.
4. El amarillo oficial es `#FFC400` (no variantes aproximadas).
