# Clickaton — Design System V2 (Identidad Visual Editorial)

**Rol:** foundation de producto para todo el ecosistema Clickaton (sitio, inscripción, paneles, tienda, app, marketing).

**Fuente de verdad de marca:** Manual de Marca + lámina de logo en `apps/clickaton/public/brand/`.

**Código:** tokens `apps/clickaton/styles/tokens.css` · utilidades `styles/utilities.css` · catálogo vivo `/design-system` (noindex).

---

## Concepto V2

Competencia · fotografía · energía · ciudad · exploración · editorial premium accesible.

Inspiración de *lenguaje* (nunca copiar): Nike · Red Bull · National Geographic · Adobe · festivales urbanos · fotografía documental.

| Sí | No |
|----|-----|
| Oscuro editorial (`#111`) | Landing amarilla dominante |
| Amarillo solo como acento | Fondos / héroes fill `#FFC400` |
| Mucho aire, composición izquierda | Bloques densos centrados |
| Bebas Neue + Montserrat + Caveat fina | Reinterpretar tipografías del Manual |
| Grain / grilla / viñeta sutiles | Glow, pills SaaS, ruido visual |
| Foto con overlay oscuro | Overlay amarillo sobre foto |

---

## Foundation

### Core colors

| Token | Hex | Uso |
|-------|-----|-----|
| `core-black` | `#111111` | Fondo principal |
| `core-gray-dark` | `#1B1B1B` | Superficies / cards |
| `core-gray-mid` | `#2A2A2A` | Elevaciones / hovers |
| `core-white` | `#FFFFFF` | Texto primario |
| `core-text-secondary` | `#B9B9B9` | Body / descripciones |
| `core-brand` | `#FFC400` | Acento (CTA, links, líneas, íconos) |

### Semantic

`--ck-background`, `--ck-surface`, `--ck-border`, `--ck-text-*`, success / warning / danger / info / community (softs calibrados para dark).

### Tipografía (Manual §05)

| Rol | Familia | Clase |
|-----|---------|-------|
| Display / Heading | **Bebas Neue** | `.ck-display-*` / `.ck-heading-*` |
| Body | **Montserrat** | `.ck-body-*` |
| Accent script | **Caveat** (fina) | `.ck-accent-script` |

Display/Heading en **mayúsculas**, escala aumentada en V2. El wordmark **no** se tipografía: es asset oficial.

### Spacing / Grid / Containers

Escala base **4px**. Ritmo semántico ampliado (`section` ~72–128px). Gutters 16/24/32. Contenedores: readable 40rem · standard 72rem · wide 80rem.

### Radius

Botones / controles: **14px** (`--ck-radius-control`). Cards: 12px. Sin pills salvo chips excepcionales.

### Elevation / Blur / Opacity

Sombras profundas suaves + glow amarillo mínimo en hover de CTA. Header: blur ~18px al scroll. Grilla urbana ~3.5% opacity. Grain ~5.5%.

### Motion

250–350ms. Solo opacity, translateY, scale ≤ 1.02, blur leve. Respetar `prefers-reduced-motion`.

### Fotografía

Protagonista. Overlays **oscuros** (`.ck-photo-overlay`). Amarillo solo como detalle gráfico.

### Logo

| Contexto | Variante |
|----------|----------|
| Header / footer oscuro | `horizontalMono` (`Wordmark tone="inverse"`) |
| Superficies claras de catálogo | `horizontal` / color |
| Favicon | `/favicon.png` |

---

## Components (estado V2)

| Pieza | Estado |
|-------|--------|
| Button (primary / secondary / outline / ghost / text) | ✅ |
| Badge, Card, Divider, IconFrame, FocusMark | ✅ |
| Input, Select, Textarea | ✅ |
| Container, Section, SectionHeader, Stack | ✅ |
| SiteHeader (blur on scroll), SiteFooter | ✅ |
| PageHero / Hero editorial oscuro | ✅ |
| Logo oficial | ✅ |
| Modal, Tabs, Toast, Tables, Commerce… | ⏳ backlog |

`Section tone="yellow"` y `Card variant="yellow"` **ya no pintan fill amarillo**: son aliases editoriales (superficie oscura + acento).

---

## Uso correcto

1. Tokens antes que hex sueltos.
2. Tipografía vía utilidades `.ck-*`.
3. Amarillo = golpe visual, nunca fondo de página.
4. Logo solo vía `Logo` / `Wordmark`.
5. No importar estética terracota de ComprameLaFoto.

---

## Sistema fotográfico

Proporción guía: **70%** superficies editoriales · **20%** fotografía · **10%** amarillo.

- Componente base: `PhotoFrame` (`apps/clickaton/components/content/PhotoFrame.tsx`)
- Presets: `apps/clickaton/lib/photography.ts`
- Galería simple: `PhotoGallery` (sin lightbox)
- Cards de listado: `MarathonCard` (portada opcional + fallback)
- Guías operativas: [PHOTOGRAPHY_GUIDELINES.md](./PHOTOGRAPHY_GUIDELINES.md)

### Variantes

`hero` · `editorial` · `card` · `gallery` · `portrait` · `jury` · `sponsor-feature` · `background` · `thumbnail`

Cada una define aspect ratio, `sizes`, overlay por defecto, borde/radio y hover.

### Tokens foto

`--ck-photo-overlay-soft|medium|strong`, `--ck-photo-radius`, `--ck-photo-border`, `--ck-photo-caption-bg`, `--ck-photo-safe-inset`, grain/vignette reutilizados.

### Créditos y a11y

- Crédito opcional (`Foto: …` / `© …` / texto ya formateado).
- Informativas: `alt` útil; decorativas: `decorative` → `alt=""`.
- Crédito fuera del `alt`.
- Sin overlays amarillos sobre foto.

### Real vs temporal

Sin material documental aún: fallback abstracto del sistema. No inventar bancos de stock ni créditos.

---

## QA visual y responsive

Auditoría Etapa 06 sobre la implementación real del DS V2 (sin redesign de identidad).

### Breakpoints reales

| Nombre | Ancho | Uso |
|--------|-------|-----|
| Mobile | ≤ 639px | CTAs apilados, menú hamburguesa, display `clamp` reducido |
| Tablet | 640–1279px | Menú hamburguesa hasta `xl`, grillas 2 columnas |
| Desktop | ≥ 1280px (`xl`) | Nav completa + CTA header |
| Contenido | gutters 16 / 24 / 32 · max 72rem |

### Reglas del hero

- Fondo `surface-base` (`#111`), grilla técnica ~4% opacity, grain + vignette suaves.
- Sin superficies amarillas dominantes.
- Título Bebas con `clamp` + `break-words` / `overflow-wrap`.
- Descripción `max-w-prose`, texto secundario `#B9B9B9`.
- CTA primary amarillo + secondary borde amarillo; en mobile `w-full` apilados.
- Padding vertical contenido (no viewport forzado vacío).

### Uso permitido del amarillo

CTA primary, secondary outline/hover, overlines, underlines activos, bordes superiores de acento en cards, indicadores FAQ/timeline, focus ring. **Prohibido** como fondo de sección/hero.

### Alternancia de superficies

| Tone `Section` | Token | Uso |
|----------------|-------|-----|
| `base` / `default` / `dark` | `--ck-surface-base` | Fondo página / héroes |
| `raised` / `muted` | `--ck-surface-raised` | Bandas alternadas |
| `elevated` / `yellow` | `--ck-surface-band` | Bandas elevadas (sin fill amarillo) |
| `accent` | community soft | Uso puntual comunidad |

### Tratamiento de fotografías

- Componente `PhotoFrame` + utilidad `.ck-photo-overlay` (overlay oscuro).
- `next/image` con `sizes`; fallback controlado si no hay `src`.
- Sin tintes amarillos ni URLs externas inventadas.

### Header

- Compacto (`h-14` / `md:h-16`), logo mono inverse.
- Scroll: blur + fondo semitransparente.
- Mobile: menú dialog con `aria-label`, Escape, cierre explícito, scroll lock, CTA dentro del panel.

### Responsive

- Corregir causa de overflow (títulos, botones, logos); no `overflow-x: hidden` global.
- Botones hero/page hero a ancho completo en mobile.
- FAQ/acordeones con focus ring amarillo.

### Motion reducido

`prefers-reduced-motion: reduce` en `globals.css` y utilidades (`.ck-frame-*`, `.ck-fade-up`, `.ck-interactive`).

### Componentes revisados (Etapa 06)

Button (forwardRef), Badge, Card, Field, Input, Select, Textarea, IconFrame, Section/SectionHeader, SiteHeader/Footer, PageHero/Hero, FAQ, PhotoFrame, showroom `/design-system`.

### Decisiones pendientes

- Fotografías reales de producto (assets locales).
- Optimizar peso PNG del logo horizontal.
- Modal / tabs / tablas.
- Evaluar nav desktop desde `lg` si crece el menú.
- Capturas QA en `docs/clickaton/qa/design-system-v2/` (locales; no obligatorias en repo).

---

## Pendientes

Fotografías reales de producto, set de iconos lineal propio, modales/tablas, motion de entrada por sección, optimizar peso de logos PNG.
