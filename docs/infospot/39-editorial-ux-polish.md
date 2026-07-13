# 39 — Pulido UX editorial

Objetivo: convertir la experiencia existente en una superficie profesional para periodistas.
**Sin features nuevas.** Sin cambios de workflow, Prisma, sync, ContentOrigin ni producción.

## Problemas encontrados

| # | Problema | Severidad |
|---|----------|-----------|
| 1 | Tres botones de guardado (autosave + Guardar + Guardar borrador) | P0 |
| 2 | “Preview”, “Flujo editorial”, “REAL”, “Slug”, “CLF”, “álbum”, “Sync”, IDs | P0 |
| 3 | CTAs duplicados “trabajo pendiente” (banner + card) | P0 |
| 4 | Timeline etiquetaba el resumen como “Editor” | P0 |
| 5 | Paso de fotos del asistente sin empty state | P0 |
| 6 | Biblioteca lateral: `<img>` sin skeleton/error | P0 |
| 7 | Cobertura: “Crear historia” + “Crear historia rápida” | P1 |
| 8 | Publicación abierta por defecto en Config (ruido al escribir) | P1 |
| 9 | `window.location.reload` al importar portada | P1 |
| 10 | Panel `AssistantPreparedPanel` muerto (duplicaba biblioteca) | P1 |
| 11 | Doble chrome en `EditorialActionsPanel` dentro del accordion | P2 |
| 12 | Zoom de fotos sin Escape confiable | P2 |

## Cambios realizados

### Editor
- Un solo CTA de guardado contextual (`Guardar` / `Guardar cambios` / `Guardar borrador`).
- En edición: submit → autosave sin abandonar la página.
- “Vista previa” en lugar de “Preview”.
- Publicación colapsada por defecto.
- Config sin jerga REAL; checklist dice “URL pública”.
- `router.refresh()` en lugar de reload completo.
- Toolbar sin scroll horizontal forzado; microtransiciones en estados de guardado.

### Biblioteca / fotos
- Thumbnails con skeleton + placeholder ante error (sin ícono roto).
- Empty state global si no hay material.
- Selector tipográfico: “Desde ComprameLaFoto”.

### Asistente
- Timeline: último paso = **Resumen**.
- Un solo patrón de trabajo pendiente (banner).
- Empty states en grilla de fotografías.
- Placeholder “Sin vista previa” en coberturas.
- Escape en zoom vía listener de ventana.

### Lenguaje periodístico
- CLF / álbum / Sync / ID / storage / stub → cobertura, ComprameLaFoto, sincronización, disponibilidad, etc.
- Página de cobertura: estados humanizados.

## Antes / después (clics estimados)

| Acción | Antes | Después |
|--------|-------|---------|
| Guardar en editor | 2 botones + autosave (confuso) | 1 botón + autosave |
| Crear historia desde cobertura | 2 CTAs | 1 CTA |
| Continuar trabajo pendiente | 2 UI | 1 banner |
| Entender último paso del asistente | “Editor” (engañoso) | “Resumen” |

**Botones visibles en toolbar del editor:** ~7 → ~4–5 (Material móvil + Config + Vista previa + Guardar).

## Responsive

- Toolbar con `overflow-x-hidden` y wrap controlado.
- Biblioteca / Config en drawers en `<lg` (ya existente).
- Sin cambios de breakpoints estructurales.

## Accesibilidad

- `aria-label` en H2/H3/Enlace del toolbar.
- Escape en zoom de fotos.
- Textos de empty states con copy accionable.

## Performance

- Evitado full page reload al importar portada.
- Sin queries nuevas; solo copy/UI.

## Recomendaciones futuras

1. Unificar del todo el picker TipTap con el asistente (una sola mental model).
2. Focus trap formal en drawers de Material/Config.
3. Inferir tipo de historia desde la intención para reducir radios en borrador.
4. Medición real de tiempo-a-primer-párrafo con analytics editoriales.

## Tests / build

```bash
pnpm --filter infospot test:editorial-assistant
pnpm --filter infospot test:editorial-workflow
pnpm --filter infospot test:editorial-photos
pnpm --filter infospot test:coverage
pnpm --filter infospot lint
pnpm --filter infospot check-types
pnpm --filter infospot build
```
