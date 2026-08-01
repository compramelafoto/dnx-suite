# Revisión de accesibilidad básica — Imp. 09

No se declara conformidad WCAG completa. Revisión transversal de patrones.

## Mejoras realizadas

- Menú móvil: `aria-modal`, `aria-label`, Escape, foco al cerrar, hit target ~44px.
- Breadcrumbs: `aria-label="Migas de pan"`.
- Loadings: `role="status"` + `aria-live="polite"`.
- Forbidden / 404 / error: headings claros y salidas explícitas.
- Botones de acción rápida del inicio con área táctil mínima.
- Estados vía badges + texto (mapas Imp. 01–08), no solo color.
- Preview de placas con `alt` descriptivo (Imp. 08).
- Confirmaciones con verbos específicos (no solo “OK”).

## Foco y teclado

- Drawer admin atrapa foco inicial en cerrar; Escape cierra.
- Links de breadcrumb con `focus-visible` outline.
- Modales reales: pocos; muchas confirms usan `window.confirm` (límite documentado en acciones sensibles).

## Labels / encabezados

- `AdminPageHeader` estandariza H1 + descripción.
- Forms: labels humanos (slug, asset id, eyebrow corregidos).
- Nav: text labels (no solo iconos).

## Contraste

- Paleta Clickatón existente (amarillo/fondo oscuro). Sin auditoría cuantitativa nueva.

## Tablas / cards

- Listados operativos: tabla `md+` + cards mobile (patrón `AdminDataTable`).
- Encabezados de tabla con `scope` en pantallas intervenidas previas.

## Lectores de pantalla

- No se ejecutó auditoría con VoiceOver/NVDA en esta etapa.
- Mensajes flash con `role="status"`.

## Límites pendientes (auditoría especializada)

1. Sustituir `window.confirm` por diálogos accesibles con focus trap.
2. Contraste AA/AAA medido en todos los tonos de badge.
3. Skip links admin.
4. Anuncios `aria-live` en actualizaciones de scanner/acreditación.
5. Tablas complejas de composición de kit: caption/headers en todos los breakpoints.
6. Reducción de movimiento (`prefers-reduced-motion`) no auditada globalmente.
7. Duplicación desktop/mobile: patrón cards evita doble árbol accionable en la mayoría de listados; revisar mensajes admin.
