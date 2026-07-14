# Clickaton — Sistema de Diseño MVP

## Principios visuales

Clickaton transmite energía, fotografía, tiempo, exploración, comunidad y aprendizaje.
Profesional accesible: joven y cercano, sin volverse infantil ni corporativo frío.

**Evitar:** dashboard SaaS genérico, bordes hiper-redondeados, degradados futuristas, sombras exageradas, plantillas shadcn por defecto, amarillo sobre blanco sin contraste suficiente.

## Paleta

| Token | Uso |
|-------|-----|
| `brand-primary` (#FFE600) | Energía, CTA |
| `brand-ink` (#0A0A0A) | Estructura, contraste |
| `brand-paper` (#FFFFFF) | Fondos |
| Grises cálidos | Superficies secundarias |
| `brand-accent` (#3B1F6E) | Acento comunitario **opcional y controlado** |

Colores semánticos (`success`, `warning`, `danger`, `info`) solo para estados funcionales.

Definición: `apps/clickaton/styles/tokens.css`.

## Tipografías

| Rol | Familia | Motivo |
|-----|---------|--------|
| Display | **Barlow Condensed** (`next/font`) | Condensada, robusta, energética para titulares |
| Sans | **DM Sans** (`next/font`) | Legible para UI, cuerpo y navegación |
| Mono | System `ui-monospace` | Coordenadas / etiquetas técnicas (sin archivo extra) |

Escala fluida: `.ck-display-*`, `.ck-heading-*`, `.ck-body-*`, `.ck-label`, `.ck-caption`, `.ck-numeric-display` en `styles/utilities.css`.

## Tokens

Organizados semánticamente: brand, interface, semantic, typography, radius, shadows, layout, motion.
No repetir hexadecimales en componentes si existe token.

## Layout primitives

- `Container` — narrow / standard / wide
- `Section` — tones: default, muted, yellow, dark, accent + grain opcional
- `SectionHeader` — eyebrow, título, descripción, align
- `Stack` — gaps verticales simples

## Componentes UI

| Componente | Variantes |
|------------|-----------|
| `Button` | primary, secondary, outline, ghost, text · sm/md/lg · loading/disabled · `href` opcional |
| `Badge` | neutral, brand, accent, success, warning, danger |
| `Card` | default, outlined, dark, yellow, interactive |
| `IconFrame` | default, yellow, dark |
| `Divider` | default, strong, yellow |
| `FocusMark` | decorativo (no isotipo) |

**No incluidos (a propósito):** inputs, modal, tabs, carousel, toast, ecommerce, etc.

## Recursos gráficos

- `ViewfinderFrame` — visor abstracto
- `CoordinateGrid` — patrón de coordenadas
- `EditorialLabel` — etiqueta editorial
- `BrushStroke` — pincelada SVG
- Utilidad `.ck-grain` — textura sutil

Todos livianos (CSS/SVG), con `aria-hidden` cuando son decorativos, y respetan `prefers-reduced-motion`.

## Decisión sobre shadcn/ui

**No se instaló shadcn/ui.**

Auditoría Etapa 02: no hay implementación de shadcn/Radix en el monorepo para reutilizar de forma saludable sin instalación global.

Los componentes MVP se construyeron con React + TypeScript + Tailwind/CSS propios de Clickaton, sin acoplar estética de otras apps.

`lucide-react` existe en otras apps; **no se agregó** a Clickaton (iconografía mínima vía SVG/`FocusMark`).

## Accesibilidad

- Foco visible global (`:focus-visible`)
- Contraste AA en amarillo/negro/blanco
- Targets táctiles ≥ 44px en botones medium+
- Decoraciones con `aria-hidden`
- Skip link al contenido principal
- `prefers-reduced-motion` desactiva animaciones del visor y reduce transitions

## Ruta interna `/design-system`

- Catálogo visual interno (no marketing)
- Metadata `robots: noindex, nofollow`
- Excluida de header/footer
- Listada en `robots.ts` como disallow

## Wordmark provisional → logo oficial

Hoy: `Wordmark` tipográfico `CLICKATON!`.

Futuro: colocar assets en `public/brand/` (ver README allí) y reemplazar el componente sin cambiar la API pública de layout.

## Uso correcto

1. Preferir tokens/utilidades tipográficas a tamaños arbitrarios.
2. Usar `Button` / `Badge` / `Card` en lugar de clases `.ck-btn` sueltas.
3. Un recurso gráfico por sección como máximo salvo composición deliberada (Hero).
4. No tratar `FocusMark` ni el visor como logo.

## Pendientes del sistema

Ver también `BACKLOG.md`:

- Logo oficial / isotipo / favicon definitivo
- Manual completo de marca
- Iconografía definitiva
- Componentes de formularios, eventos, inscripción, tienda, ranking
- Motion avanzado
- Storybook solo si el volumen futuro lo justifica
