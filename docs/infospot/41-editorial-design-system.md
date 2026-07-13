# 41 — Editorial Design System (Info Spot)

Superficie de escritura y redacción: experiencia editorial premium sin nuevas funcionalidades.

Inspiración de **principios** (no de look & feel literal): Medium, Notion, Linear, Arc, Substack, Ghost, Craft.

---

## Principios

1. **Contenido primero** — menos cajas, menos bordes, menos botones; más aire y foco tipográfico.
2. **Una sola familia de componentes** — no cuatro cards distintas para el mismo trabajo.
3. **Escala cerrada** — espaciado y tipografía desde tokens; evitar valores arbitrarios.
4. **Microinteracciones sobrias** — 150–250 ms; respetar `prefers-reduced-motion`.
5. **Sin jerga administrativa** — empty states y timeline periodísticos.

**Fuera de alcance de este documento:** Workflow, Prisma, ContentOrigin, Sync CLF, Coberturas (lógica), Geo, Distribución, Permisos, API, migraciones, producción.

---

## Escalas

### Espaciado (`styles/spacing.css`)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96…` vía `--is-space-*`.

Preferir `space-y-6/8/10`, `gap-8`, `p-6` alineados a la escala.

### Tipografía

| Rol | Token / clase | Tamaño aprox. |
|-----|---------------|---------------|
| Título de historia | `--is-type-title` / `.is-input-title` / `.is-editorial-title` | 40–56 |
| Bajada | `--is-type-dek` / `.is-input-dek` / `.is-editorial-dek` | 20–24 |
| Heading (H2) | `--is-type-h2` | 28–36 |
| Subheading (H3) | `--is-type-h3` | 22–28 |
| Cuerpo | `--is-type-body` | 18 |
| Caption | `--is-type-caption` | 14 |

- **Sans:** Plus Jakarta Sans (`--font-info-sans` / `--is-font-sans`)
- **Serif editorial:** Source Serif 4 (`--font-source-serif` / `--is-font-serif`) — títulos de escritura y display de redacción

### Radius

`--is-radius-sm|md|lg|xl` + alias `--is-radius` (= md).

### Motion

`--is-duration-150` / `200` · `--is-ease-out` · ver `styles/motion.css` y `editorial-surfaces.css`.

---

## Botones

Clases canónicas en `app/globals.css`:

| Variante | Clase |
|----------|--------|
| Primary | `.is-btn.is-btn-primary` |
| Secondary | `.is-btn.is-btn-secondary` |
| Ghost | `.is-btn.is-btn-ghost` |
| Danger | `.is-btn.is-btn-danger` |
| Icon | `.is-btn.is-btn-icon` |

Compat marketing: `.is-btn-solid`, `.is-btn-on-dark`, `.is-btn-outline-on-dark`.

No inventar botones ad hoc en redacción: reutilizar estas clases.

---

## Inputs

Unificados en `styles/editorial-surfaces.css`:

- `.is-input` / `.is-textarea` / `.is-select` — altura 44px, padding, focus ring acento
- `.is-input-label` / `.is-input-helper` / `.is-input-error`
- Escritura: `.is-input-title`, `.is-input-dek` (sin caja)

Formularios de redacción (`article-form`, `event-editor-form`, etc.) usan `fieldClass = "is-input mt-2"`.

---

## Cards

- Genérica: `.is-card` (+ `--interactive`, `--active`)
- Material: `.is-material-item` + variantes por **borde de color** y fondo suave:
  - `--cover` · `--gallery` · `--insert` · `--used` · `--processing` · `--unavailable` · `--favorite`
- No depender solo de badges: el color lateral comunica el estado.

---

## Timeline

`AssistantTimeline` + `.is-timeline*` :

- Checkmarks periodísticos (✓), no “Paso 3 de 6”
- Estados: done / current / upcoming
- Cerca del final: *«Ahora escribí tu historia.»* (`.is-timeline-footer`)

Solo presentación; la lógica del asistente no cambia.

---

## Editor

- Superficie: `.is-writing-surface` + `.is-editor-shell`
- Toolbar liviana; cuerpo TipTap con más aire (`min-height` generoso, leading 1.75)
- Configuración y metadata **fuera** del canvas (drawer)
- Material solo desde biblioteca lateral

---

## Material (biblioteca)

`MaterialLibraryPanel`:

- Jerarquía: favoritas → portada → galería → para insertar → usadas → procesando → no disponibles
- Empty: «Todavía no agregaste fotografías.»
- CTA: «Agregar material» → asistente
- Thumbs: skeleton `.is-skeleton` + fade-in

---

## Drawers

Patrón `.is-editorial-drawer*`:

- Overlay + panel derecho
- Header / body / footer compartidos
- Escape + botón cerrar (comportamiento existente en forms)
- Animación 200 ms; reduced-motion desactiva

Usado en biblioteca móvil y configuración del artículo.

---

## Header editorial

`redaccion-shell-client` (modo editor): chrome más bajo (`min-h-12`, menos padding). Sticky + blur.

Toolbar de escritura: `.is-editorial-toolbar`.

---

## Animaciones

| Interacción | Duración |
|-------------|----------|
| Hover / focus colores | 150 ms |
| Drawer open | 200 ms |
| Insert / selección material | 150–200 ms |
| Skeleton shine | ~1.2 s loop |

---

## Responsive

- Desktop: escritura + rail sticky biblioteca
- Tablet / móvil: biblioteca y config en drawer; sin overflow horizontal en toolbar (`overflow-x-hidden` + wrap)
- Breakpoints existentes Tailwind; rail `lg:`

---

## Accesibilidad

- `focus-visible` global con outline acento
- Drawers: `role="dialog"`, `aria-modal`, labels
- Timeline: `aria-current="step"`, estados en `sr-only`
- Favoritos: `aria-pressed`
- Contraste acento naranja sobre blanco; texto secundario en `--is-muted`

---

## Performance visual

- Evitar spinners infinitos: skeleton + opacity fade en thumbs
- Sticky rails con `max-height` + scroll interno (sin saltar layout de página)
- Fuente serif cargada con `display: swap`

---

## Archivos clave

| Área | Path |
|------|------|
| Tokens | `apps/infospot/styles/*` |
| Superficies editoriales | `apps/infospot/styles/editorial-surfaces.css` |
| Botones / prose | `apps/infospot/app/globals.css` |
| Fuentes | `apps/infospot/app/layout.tsx` |
| Editor | `components/redaccion/article-form.tsx`, `visual-editor/*` |
| Biblioteca | `components/redaccion/material-library-panel.tsx` |
| Timeline | `components/redaccion/editorial-assistant/assistant-timeline.tsx` |

---

## Relacionados

- `38-writing-surface.md` — superficie de escritura
- `39-editorial-ux-polish.md` — copy / empty states
- `40-unified-editorial-material-flow.md` — flujo de material
