# Fotorank — Patrones de dashboard (herramientas)

Referencia para vistas administrativas con filtros, listados y acciones en cabecera. Implementación: `apps/fotorank/app/components/dashboard-patterns/`.

## Principios

1. **Ancho máximo** alineado con la barra superior: `fr-dashboard-page-shell` (1280px).
2. **Jerarquía:** metadata de organización (layout de módulo) ≠ cabecera de vista (página) ≠ contenido.
3. **Filtros:** altura de control uniforme (40px), labels explícitos, pie del panel con Aplicar + Limpiar.
4. **Estados vacíos:** proporción controlada, icono + copy + CTA; evitar contenedores con exceso de aire muerto.
5. **Acciones en header:** estilo secundario borde + hover dorado (`HeaderSecondaryLink`).

## Componentes

| Export | Rol |
|--------|-----|
| `DashboardPageHeader` | Título, descripción, `actions`, `eyebrow` |
| `DashboardBreadcrumb` | Migas |
| `HeaderSecondaryLink` | CTA secundaria con icono/badge |
| `ContextOrgChip` | Organización como chip, no barra full-width |
| `TwoColumnToolLayout` | Sidebar + main |
| `FilterSidebarCard` | Card de filtros con footer |
| `FilterField` | Label + control |
| `DashboardEmptyState` | Empty state de listado |

## CSS (globals Fotorank)

- `fr-dashboard-page-shell`
- `fr-filter-input`, `fr-filter-select`

## Responsive

- `< lg`: columnas apiladas; filtros arriba.
- `≥ lg`: filtros izquierda sticky, resultados derecha.

## Pantallas candidatas a reutilizar

Directorio de jurados (referencia), invitaciones enviadas, listados de concursos con filtros, auditoría, diplomas por concurso.
