# Clickaton — Design System V1 (Identidad Visual)

**Rol:** foundation de producto para todo el ecosistema Clickaton (sitio, inscripción, paneles, tienda, app, marketing).

**Fuente de verdad de marca:** Manual de Marca + lámina de logo en `apps/clickaton/public/brand/`.

**Código:** tokens `apps/clickaton/styles/tokens.css` · utilidades `styles/utilities.css` · catálogo vivo `/design-system` (noindex).

---

## Concepto

Clickaton no es solo una competencia: es una comunidad internacional donde fotografía, creatividad, aprendizaje y exploración se unen en experiencias.

**Personalidad de interfaz:** moderna, luminosa, amigable, optimista, cercana, profesional, elegante, divertida, creativa.

| Sí | No |
|----|-----|
| Editorial, cálida, memorable | Tecnológica / SaaS genérico |
| Fondos claros, amarillo como acento | Oscura por defecto / gamer |
| Bebas Neue + Montserrat | Reinterpretar tipografías del Manual |
| Logo oficial (asset) | Reconstruir wordmark con fuentes UI |
| Sombras suaves, espacio primero | Bordes hiper-redondeados, glow, plantillas |

Inspiración de *lenguaje* (nunca copiar): Leica · Patagonia · Domestika · Strava · Red Bull · National Geographic.

---

## Foundation

### Color (Manual §04)

| Token | Hex | Uso |
|-------|-----|-----|
| `brand-primary` | `#FFC400` | Acento / CTA (no saturar) |
| `brand-ink` | `#000000` | Texto, estructura |
| `brand-paper` | `#FFFFFF` | Fondos |
| `brand-gray` | `#F2F2F2` | Superficies secundarias |
| `brand-violet` | `#6C53FF` | Comunidad / acento controlado |
| `brand-blue` | `#00AEEF` | Info / tecnología |
| `brand-green` | `#4CAF50` | Éxito |

Semánticos (`success`, `warning`, `danger`, `info`, `community`) solo para estados.

### Tipografía (Manual §05)

| Rol | Familia | Clase / token |
|-----|---------|---------------|
| Display | **Bebas Neue** | `.ck-display-*` |
| Heading | **Bebas Neue** | `.ck-heading-*` |
| Body | **Montserrat** | `.ck-body-*` |
| Caption | Montserrat | `.ck-caption` |
| Labels | Montserrat bold uppercase | `.ck-label` |
| Overline | Montserrat bold uppercase | `.ck-overline` |
| Buttons | Montserrat semibold uppercase | `.ck-button-label` |
| Accent script | Caveat (frases cortas) | `.ck-accent-script` |
| Mono | System mono | `.ck-mono` (coordenadas / sellos) |

Display/Heading van en **mayúsculas** (naturaleza de Bebas Neue). El wordmark del logo **no** se tipografía: es PNG/SVG oficial.

### Espaciado

Escala base **4px** (`--ck-space-*`). Ritmo semántico: `title-to-subtitle`, `subtitle-to-content`, `block`, `section`, `content-to-actions`.

### Grid (mobile first)

| Breakpoint | Columnas | Gutter |
|------------|----------|--------|
| Mobile | 4 | 16px |
| Tablet | 8 | 24px |
| Desktop | 12 | 32px |

Contenedores: readable 40rem · standard 72rem · wide 80rem.

### Bordes y radios

Identidad editorial, no “pill SaaS”:

- Controles / botones: `--ck-radius-control` (12px)
- Cards: `--ck-radius-card` (8px)
- Pill solo en chips excepcionales

Borde fuerte negro (`2px`) como firma de contraste.

### Elevaciones

Sombras muy suaves (`subtle` / `elevated`). Priorizar separación por espacio sobre sombra.

### Motion

Rápido, elegante, inspirado en enfoque / obturador:

- Duraciones: 80 / 150 / 240 / 400ms
- Easing: standard, emphasized, shutter
- Respetar `prefers-reduced-motion`

### Iconografía e ilustración

- Iconos lineales de peso consistente (fotografía, mapas, comunidad, exploración) — **no Material Design**.
- Recursos gráficos con moderación: pinceladas, grain (`.ck-grain`), coordenadas, sellos, `EditorialLabel`, `BrushStroke`, `ViewfinderFrame`.
- Máximo un recurso decorativo dominante por sección (salvo hero compuesto a propósito).

### Fotografía

Personas reales, emoción, ciudades, exploración, backstage, aprendizaje. Sin catálogo stock genérico.

### Logo

Rutas centralizadas: `apps/clickaton/config/brand-assets.ts`.

Componente `Logo` / `Wordmark` → assets en `/public/brand/`.

| Contexto | Variante |
|----------|----------|
| Hero | `principal` |
| Header | `horizontal` |
| Footer oscuro | `horizontalMono` |
| Favicon | `/favicon.png` (+ `favicon-32` en brand) |

**Prohibido:** distorsionar, recolorear fuera de variantes oficiales, reconstruir con fuentes.

---

## Components (estado V1)

| Pieza | Estado |
|-------|--------|
| Button (primary / secondary / outline / ghost / text) | ✅ |
| Badge | ✅ |
| Card | ✅ |
| Divider, IconFrame, FocusMark | ✅ |
| Container, Section, SectionHeader, Stack | ✅ |
| Navbar / Footer | ✅ (chrome) |
| Logo oficial | ✅ |
| Inputs, Modal, Tabs, Toast, Tables, Commerce… | ⏳ backlog DS |

## Aplicación en producto (Etapa 06B)

El DS V1 ya no es solo catálogo: Home, chrome y páginas públicas usan tokens, tipografía Manual y logos oficiales vía `config/brand-assets.ts`.

Pendientes visuales: SVG vectoriales definitivos, optimizar peso de `logo-horizontal.png` (~476KB), fotografías reales, motion de marca, templates de redes.

---

## Patterns & templates (roadmap)

Login · Registro · Checkout · Inscripción · Perfil · Dashboard · Ranking · Galería · Tienda · Evento · Jurado · Organización · Home · Landing · Panel.

Se construyen **sobre** estos tokens — no como pantallas aisladas.

---

## Accesibilidad

- Foco visible global
- Contraste AA negro / blanco / amarillo `#FFC400` + texto negro en CTA
- Targets táctiles ≥ 44px (botones md+)
- Decoraciones `aria-hidden`
- Skip link
- `prefers-reduced-motion`

---

## Uso correcto

1. Tokens antes que hex sueltos.
2. Tipografía vía utilidades `.ck-*`.
3. Amarillo como acento, no como fondo de página completa salvo bandas deliberadas.
4. Logo solo vía `Logo` / `Wordmark`.
5. No importar estética de FotoRank (oscuro) ni ComprameLaFoto (terracota).

---

## Pendientes

Ver `BACKLOG.md`: SVG vectoriales definitivos del estudio, set de iconos propio, formularios, cards de dominio, Storybook si el volumen lo justifica.
