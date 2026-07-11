# Info Spot — Design System Foundations

**Versión:** 1.0  
**Estado:** Fundaciones oficiales (tokens y escalas)  
**Alcance:** Solo documentación. No implica cambios de UI ni implementación.

> Los valores marcados como **referencia actual** reflejan tokens existentes en `apps/infospot/app/globals.css`. Son la base provisional hasta validación formal de marca.

---

## 1. Principios de foundations

- Tokens semánticos primero (`--is-*`), no hex sueltos en componentes.
- Escalas cortas y memorables.
- Preferir claridad editorial sobre expresividad de producto.
- Motion sutil; nunca ornamental.
- Light-first: sin dark mode en el lanzamiento.

---

## 2. Escala tipográfica

### Familia

| Rol | Familia | Token / nota |
| --- | --- | --- |
| Sans UI + editorial | Plus Jakarta Sans | `--font-info-sans` (referencia actual) |
| Fallback | `ui-sans-serif, system-ui, sans-serif` | Solo fallback técnico |

> **Punto abierto:** evaluar display/serif editorial para `Display` y `Headline` sin perder cohesión.

### Roles y tamaños recomendados

| Rol | Clase / token conceptual | Mobile | Desktop | Peso | Leading | Tracking |
| --- | --- | --- | --- | --- | --- | --- |
| Display | `is-display` | 2rem–2.5rem | 3rem–3.5rem | 700 | 1.15 | -0.03em |
| Title article | `is-title-article` | 1.75rem–2rem | 2.25rem–2.75rem | 700 | 1.15 | -0.025em |
| Title section | `is-title-section` | 1.375rem–1.5rem | 1.5rem–1.75rem | 700 | 1.3 | -0.02em |
| Subtitle | `is-subtitle` | 1.125rem | 1.125–1.25rem | 400–500 | 1.3 | 0 |
| Dek | `is-dek` | 1.125rem | 1.25rem | 400 | 1.75 | 0 |
| Body | `is-body` | 1.0625rem | 1.0625–1.125rem | 400 | 1.7 | 0 |
| Meta | `is-meta` | 0.8125rem | 0.8125rem | 400–500 | 1.4 | 0.01em opcional |
| Caption | `is-caption` | 0.875rem | 0.875rem | 400 | 1.5 | 0 |
| Label | `is-label` | 0.6875rem | 0.6875rem | 700 | 1.2 | 0.04em |

### Leading tokens (referencia actual)

| Token | Valor |
| --- | --- |
| `--is-leading-tight` | `1.15` |
| `--is-leading-snug` | `1.3` |
| `--is-leading-body` | `1.7` |
| `--is-leading-relaxed` | `1.75` |

---

## 3. Escalas de colores

### Neutros

| Token | Hex | Uso |
| --- | --- | --- |
| `--is-bg` | `#ffffff` | Fondo global |
| `--is-bg-secondary` | `#f5f6f8` | Secciones alternadas |
| `--is-surface` | `#ffffff` | Superficies |
| `--is-surface-muted` | `#eef0f3` | Placeholders / muted surfaces |
| `--is-text` | `#1a1d23` | Texto principal |
| `--is-text-secondary` | `#4a5160` | Cuerpo / subtítulo |
| `--is-muted` | `#6b7380` | Meta / captions |
| `--is-border` | `#e4e7ec` | Hairlines |
| `--is-border-strong` | `#c9ced8` | Énfasis / empty dashed |

### Acento (naranja Info Spot)

| Token | Hex | Uso |
| --- | --- | --- |
| `--is-accent` | `#e85d04` | Primario / focus / links activos |
| `--is-accent-hover` | `#c44e03` | Hover |
| `--is-accent-soft` | `#fff0e6` | Fondos soft / selection bg |
| `--is-accent-ink` | `#9a3d02` | Texto sobre soft |

### Semánticos funcionales

| Token | Hex | Uso |
| --- | --- | --- |
| `--is-success` | `#15803d` | Éxito |
| `--is-success-soft` | `#ecfdf3` | Fondo éxito |
| `--is-warning` | `#b45309` | Advertencia |
| `--is-warning-soft` | `#fffbeb` | Fondo warning |
| `--is-error` | `#b91c1c` | Error |
| `--is-error-soft` | `#fef2f2` | Fondo error |

### Reglas de uso

- El acento no se usa como fondo de página.
- Texto largo siempre en `text` / `text-secondary`, nunca en accent.
- Contraste mínimo AA para texto; AAA deseable en cuerpo.
- No introducir púrpuras, neones ni gradientes de marca.

> **Punto abierto:** publicar escala extendida accent-50…900 y validar contraste de `accent` sobre blanco para texto pequeño.

---

## 4. Spacing

Base **4px**.

| Token | Rem | Px |
| --- | --- | --- |
| `--is-space-1` | 0.25rem | 4 |
| `--is-space-2` | 0.5rem | 8 |
| `--is-space-3` | 0.75rem | 12 |
| `--is-space-4` | 1rem | 16 |
| `--is-space-5` | 1.25rem | 20 |
| `--is-space-6` | 1.5rem | 24 |
| `--is-space-8` | 2rem | 32 |
| `--is-space-10` | 2.5rem | 40 |
| `--is-space-12` | 3rem | 48 |
| `--is-space-16` | 4rem | 64 |
| `--is-space-20` | 5rem | 80 |
| `--is-space-24` | 6rem | 96 |

### Ritmo de sección (conceptual)

| Densidad | Uso | Padding vertical guía |
| --- | --- | --- |
| `md` | Bloques compactos | ~48–64px |
| `lg` | Secciones estándar | ~64–96px |
| `xl` | Heroes / cierres | ~96–128px |

---

## 5. Radios

| Token | Valor | Uso |
| --- | --- | --- |
| `--is-radius-sm` | 0.25rem (4) | Badges / labels |
| `--is-radius-md` | 0.5rem (8) | Imágenes / controles / cards |
| `--is-radius-lg` | 0.75rem (12) | Paneles / bloques mayores |

### Reglas

- Radios contenidos: no `rounded-full` como estilo de marca (salvo avatares circulares o icon buttons).
- Heroes full-bleed pueden tener radio 0 en bordes de viewport.
- Evitar radios grandes tipo “app card” que empujen a look de dashboard.

---

## 6. Sombras

Sombras **mínimas**. Preferir borde hairline + espacio.

| Token | Valor | Uso |
| --- | --- | --- |
| `--is-shadow-sm` | `0 1px 2px rgba(26, 29, 35, 0.04)` | Elevación sutil |
| `--is-shadow-md` | `0 8px 24px -16px rgba(26, 29, 35, 0.18)` | Dropdowns / overlays puntuales |

### Reglas

- No apilar multi-shadow.
- No usar glow de acento.
- Cards editoriales: borde antes que sombra.
- Modales/menus: `shadow-md` aceptable.

---

## 7. Breakpoints

| Nombre | Min-width | Uso |
| --- | --- | --- |
| `sm` | 640px | Controles / nav parcial |
| `md` | 768px | Grillas 2 columnas / pad-x 24 |
| `lg` | 1024px | Layout editorial completo / pad-x 32 |
| `xl` | 1280px | Max site / pad-x 40 |
| `2xl` | 1536px | Opcional; no estirar medida de lectura |

### Pad-x responsivo (referencia actual)

| Breakpoint | `--is-pad-x` |
| --- | --- |
| default | 1.25rem (20) |
| ≥768 | 1.5rem (24) |
| ≥1024 | 2rem (32) |
| ≥1280 | 2.5rem (40) |

---

## 8. Grid

### Principios

- Grid de 12 columnas en desktop editorial.
- Gutters alineados a spacing scale (16–24–32).
- Home: composición asimétrica (hero dominante + secundarios), no mosaico uniforme.
- Listados: 1 col mobile → 2–3 cols desktop según densidad.
- Artículo: una columna de lectura; media puede romper a `media-max`.

### Patrones

| Patrón | Mobile | Desktop |
| --- | --- | --- |
| Hero + stack | 1 col | Hero full / 7–8 + 4–5 |
| Card grid | 1 col | 2–3 cols |
| Agenda | 1 col | 1–2 cols |
| Perfil (org/foto) | stack | 4 + 8 o 3 + 9 |

---

## 9. Containers

| Token | Valor | Uso |
| --- | --- | --- |
| `--is-site-max` | 80rem (1280) | Shell general |
| `--is-editorial-max` | 73.75rem (1180) | Grillas editoriales |
| `--is-media-max` | 60rem (960) | Media ancha en artículo |
| `--is-article-max` | 45rem (720) | Columna de lectura |
| `--is-header-h` | 4.25rem | Altura header |

### Reglas

- El cuerpo del artículo no debe crecer con el viewport más allá de `article-max`.
- El site shell puede llegar a `site-max`; el contenido editorial suele vivir en `editorial-max`.
- Full-bleed: romper container solo para heroes/fotografía, no para texto.

---

## 10. Motion

### Principios

- Motion = presencia y jerarquía, no ruido.
- Duraciones cortas; easing suave.
- Respetar `prefers-reduced-motion`.

### Tokens conceptuales

| Token | Valor guía | Uso |
| --- | --- | --- |
| `motion-fast` | 120–160ms | Hover, focus, toggles |
| `motion-base` | 200–240ms | Paneles, menus |
| `motion-slow` | 320–400ms | Transiciones de página / reveals |
| `ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Default |
| `ease-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | Entradas editoriales |

### Permitido

- Fade / soft translate en aparición de secciones.
- Hover de borde/opacidad en cards.
- Transición de menú mobile.
- Image reveal suave al cargar.

### No permitido

- Parallax agresivo.
- Bounce / elastic en UI.
- Autoplay de carruseles ruidosos.
- Animar el logo de forma juguetona.
- Loaders con marca distorsionada.

> **Punto abierto:** definir 2–3 motions de marca para lanzamiento (p. ej. hero fade, card hover, page enter).

---

## 11. Tokens — inventario semántico

### Naming

Prefijo: `--is-`  
Categorías: `color`, `space`, `radius`, `shadow`, `leading`, layout (`site-max`, `pad-x`, …).

### Checklist de tokenización

- [ ] Color roles completos
- [ ] Type roles + sizes fluidas documentadas
- [ ] Spacing scale
- [ ] Radius / shadow
- [ ] Containers / breakpoints
- [ ] Motion
- [ ] Focus ring = accent
- [ ] Selection = accent-soft + accent-ink

### Focus y selection (referencia actual)

- Focus visible: outline 2px `accent`, offset 3px.
- Selection: background `accent-soft`, color `accent-ink`.

---

## 12. Z-index (guía)

| Capa | Rango | Uso |
| --- | --- | --- |
| Content | 0–10 | Contenido |
| Sticky header | 40–50 | Header |
| Overlay | 60–70 | Menú mobile / scrim |
| Modal | 80–90 | Diálogos |
| Toast | 100 | Notificaciones |

---

## Documentos relacionados

- `01-brand-book.md` — significado de color/tipo  
- `04-component-library.md` — consumo de tokens en componentes  
- `06-responsive.md` — reglas por breakpoint  
