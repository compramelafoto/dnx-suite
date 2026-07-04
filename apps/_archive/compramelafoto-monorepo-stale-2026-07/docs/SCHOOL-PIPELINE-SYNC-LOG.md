# SCHOOL PIPELINE SYNC LOG (Legacy)

Este documento es la **fuente de verdad** del flujo escolar / preventa canjeable / diseño / revisión / preview / export **tal como está implementado en el repo legacy**. Está basado en el **código real** y sirve como guía de réplica para el monorepo.

## Alcance auditado

- Selección escolar (persistencia real)
- Resolución de template y validaciones
- DesignProject / DesignRevision
- Preflight de render
- Revisión humana
- Editor manual
- Preview real + jobs + polling
- Export final + jobs + polling
- UI de revisión
- Prisma schema + migraciones
- Logs y reglas críticas de negocio

## Resumen ejecutivo del flujo completo

1. **Canje PREVENTA_PACK** → persiste `Selection` y `SelectionPhoto` para ítems escolares.
2. **Resolución de template** (pack REQUIRED o fallback de producto) y **validación** por roles/cantidad.
3. Si todo OK: `PreCompraOrderItem` → `READY_TO_DESIGN`, se crea `DesignProject`.
4. **Mapping determinístico** slot↔foto y **preflight** de render.
5. Se crea `DesignRevision` inicial (schemaVersion 3) y se marca `DesignProject` como `PENDING_PHOTOGRAPHER_APPROVAL`.
6. **Editor** permite overrides (crop/zoom/rotación, swap, replace, textos).
7. **Preview real** con `sharp` + job asíncrono (`DesignPreviewJob`).
8. **Aprobación** bloqueada si preview no está lista.
9. **Export final** asíncrono con `DesignExportJob`, genera JPG final y deja listo para descarga.

## Estado y transiciones

### Estados (DesignProject.status)

- `DRAFT` → base (creación).
- `DRAFT_RENDERING` → previo a generar preview.
- `PENDING_PHOTOGRAPHER_APPROVAL` → listo para revisión.
- `APPROVED_FOR_EXPORT` → aprobado por fotógrafo.
- `NEEDS_ADJUSTMENT` → rechazado.
- `EXPORTING` → export final en curso.
- `EXPORTED` → export final listo.

### Transiciones reales (según código)

- `WAITING_SELECTION` → `READY_TO_DESIGN` (PreCompraOrderItem) si: selección completa + template resuelto + validación OK.
- `DesignProject: DRAFT/NEEDS_ADJUSTMENT` → `DRAFT_RENDERING` al crear/enriquecer preflight.
- `DesignProject: DRAFT/DRAFT_RENDERING/NEEDS_ADJUSTMENT` → `PENDING_PHOTOGRAPHER_APPROVAL` cuando se crea o enriquece `DesignRevision` con preflight.
- `PENDING_PHOTOGRAPHER_APPROVAL` → `APPROVED_FOR_EXPORT` (endpoint approve).
- `PENDING_PHOTOGRAPHER_APPROVAL` → `NEEDS_ADJUSTMENT` (endpoint reject).
- `NEEDS_ADJUSTMENT` → `DRAFT_RENDERING` (endpoint regenerate).
- `APPROVED_FOR_EXPORT` → `EXPORTING` (endpoint export).
- `EXPORTING` → `EXPORTED` (worker export ok).
- En caso de error en export: `EXPORTING` → `APPROVED_FOR_EXPORT` (worker export falla).

## Reglas de negocio críticas

### Resolución de template (canje escolar)

Fuente: `lib/preventa-canjeable/redeem-preventa-pack-order-v1.ts`.

- Si hay **beneficios REQUIRED** con template:
  - Si alguno no tiene template → `NONE` (razón `required_template_missing`).
  - Si hay más de un template distinto → `AMBIGUOUS`.
  - Si hay exactamente uno → `PACK_REQUIRED`.
- Si no hay REQUIRED:
  - Si `albumProduct.requiresDesign` y tiene `defaultTemplateId` → `ALBUM_PRODUCT_DEFAULT`.
  - Si requiere diseño pero no hay template → `NONE` (`album_product_template_missing`).
  - Si no requiere diseño → `NONE` (`no_design_required`).

### Validación de selección contra template

Fuente: `validateSelectionAgainstTemplate`.

- Si el template **no define roles**, valida solo por cantidad (`selectedCount >= slots.length`).
- Si define roles, exige:
  - No faltan roles.
  - No hay duplicados.
  - No hay roles desconocidos.
- Si falla, **no** crea DesignProject ni cambia estado.

### Mapping slot ↔ foto

Fuente: `buildInitialTemplateSlotAssignments`.

Orden de slots:
1) `pageIndex`, 2) `index`, 3) `id`.

Orden de fotos:
1) `position`, 2) `id`.

Reglas:
- Si hay roles en slots:
  - Primero asigna por rol (estable).
  - Slots sin rol se completan por orden.
- Si faltan fotos para slots → `isValid=false`.
- Fotos extra quedan en `unassignedSelectionPhotoIds`.

### Preflight inicial

Fuente: `buildInitialRenderPreflight`.

Valida:
- slot asignado existe.
- selectionPhoto existe.
- foto no removida.
- asset (previewUrl u originalKey).
- bbox válido.

Genera `slotRenderData` con:
`fitMode=COVER`, `x/y=bbox`, `scale=1`, `rotation=0`.

### Aprobación

Endpoint `approve` bloquea si:
- `previewStatus === RENDERING`
- `previewStatus === FAILED`
- `previewDirty === true`

### Preview regeneration

Endpoint `regenerate-preview`:
- Deduplica jobs PENDING/PROCESSING.
- Marca `previewStatus=RENDERING`, `previewDirty=false`.
- Encola `DesignPreviewJob`.

### Export final

Endpoint `export` solo permite si:
- `DesignProject.status === APPROVED_FOR_EXPORT`
- `previewStatus === READY`
- `previewDirty === false`
- No hay job PENDING/PROCESSING

Worker `process-design-exports`:
- Exige `DesignProject.status === EXPORTING`.
- Falla si preview no está READY o template faltante.
- En éxito: actualiza `DesignRevision.dataJson` con URLs y marca `DesignProject.status=EXPORTED`.
- En error: vuelve `DesignProject.status` a `APPROVED_FOR_EXPORT`.

## Prisma: modelos y campos relevantes

En `prisma/schema.prisma`:

- `Selection` (1:1 con `PreCompraOrderItem`).
- `SelectionPhoto` con `role` y `position`.
- `TemplateSlot` con `pageIndex` y `role`.
- `DesignProject` con campos de review (`approvedAt`, `reviewReason`, etc.) y estados.
- `DesignRevision` con `dataJson`.
- `DesignPreviewJob` y `DesignExportJob` como colas.

## Migraciones relacionadas

- `20260408150000_school_template_roles` → roles + pageIndex.
- `20260408183000_design_review_status` → estados + campos de review.
- `20260408200000_design_preview_jobs` → `DesignPreviewJob`.
- `20260408212000_design_export_jobs` → `DesignExportJob`.

## Estructura real de `DesignRevision.dataJson`

Fuente: `lib/school-render/design-editor.ts`.

```json
{
  "schemaVersion": 3,
  "templateId": 123,
  "orderItemId": 456,
  "assignments": [
    { "slotId": 1, "slotRole": "PHOTO_MAIN", "selectionPhotoId": 10, "selectionPhotoRole": "PHOTO_MAIN", "source": "ROLE_MATCH" }
  ],
  "unassignedSelectionPhotoIds": [11, 12],
  "unfilledRequiredSlotIds": [],
  "preflight": { ... },
  "slotOverrides": {
    "1": { "cropX": 0, "cropY": 0, "zoom": 1, "rotation": 0, "fitMode": "COVER", "manualOverride": true }
  },
  "textOverrides": {
    "student_name": { "overrideValue": "Juan", "isOverridden": true }
  },
  "previewDirty": false,
  "previewStatus": "READY",
  "previewGeneratedAt": "2026-04-09T12:00:00Z",
  "previewVersion": 2,
  "previewUrl": "https://...",
  "previewWidth": 1600,
  "previewHeight": 1200,
  "previewError": null,
  "exportStatus": "EXPORTED",
  "exportUrlJpg": "https://...",
  "exportUrlPdf": null,
  "exportWidth": 3000,
  "exportHeight": 2250,
  "exportGeneratedAt": "2026-04-09T12:10:00Z",
  "exportVersion": 1,
  "exportError": null
}
```

## Endpoints y comportamiento

### Diseño / revisión

- `POST /api/dashboard/design-projects/[id]/approve`
  - Bloquea si preview no está lista.
  - Llama `approveDesignProject`.
- `POST /api/dashboard/design-projects/[id]/reject`
  - Requiere `reason`.
  - Llama `rejectDesignProject`.
- `POST /api/dashboard/design-projects/[id]/regenerate`
  - Llama `requestDesignRegeneration`.
- `GET /api/dashboard/design-projects/[id]/editor`
  - Devuelve template + selección + dataJson normalizado.

### Editor manual

- `POST /api/dashboard/design-revisions/[id]/slot-transform`
- `POST /api/dashboard/design-revisions/[id]/reset-slot-transform`
- `POST /api/dashboard/design-revisions/[id]/swap-slots`
- `POST /api/dashboard/design-revisions/[id]/replace-photo`
- `POST /api/dashboard/design-revisions/[id]/text-override`

Todas:
- Validan permisos y ownership.
- Marcan `previewDirty=true` y `previewStatus=DIRTY`.
- Loguean con prefijo `[school_design_editor]`.

### Preview (jobs)

- `POST /api/dashboard/design-revisions/[id]/regenerate-preview`
  - Dedup de job.
  - `previewStatus=RENDERING`.
  - Encola `DesignPreviewJob`.
- `GET /api/dashboard/design-revisions/[id]/preview-status`
  - Estado liviano para polling.
  - `updatedAt` se devuelve como `null` (el modelo no expone `updatedAt` en este schema).
- `GET /api/cron/process-design-previews`
  - Procesa jobs PENDING.
  - Render con `renderDesignPreview`.
  - Sube a R2 (`design-previews`).

### Export final (jobs)

- `POST /api/dashboard/design-projects/[id]/export`
  - Requiere `APPROVED_FOR_EXPORT` + preview READY.
  - `DesignProject.status = EXPORTING`.
  - `exportStatus=EXPORTING` en dataJson.
  - Encola `DesignExportJob`.
- `GET /api/dashboard/design-revisions/[id]/export-status`
  - Estado liviano para polling.
  - `updatedAt` se devuelve como `null` (el modelo no expone `updatedAt` en este schema).
- `GET /api/cron/process-design-exports`
  - Procesa jobs PENDING.
  - Render con `renderDesignExport`.
  - Sube a R2 (`design-exports`).
  - Setea `DesignProject.status = EXPORTED` en éxito.

### Cleanup

- `GET /api/cron/cleanup-disenador`
  - Borra templates huérfanos y `DesignProject` antiguos en `DRAFT`/`DRAFT_RENDERING`.

## UI de revisión (`app/dashboard/design-projects/[id]/page.tsx`)

- Preview real si `previewUrl` existe, con cache-busting `?v=previewVersion`.
- Fallback HTML/CSS si no hay preview.
- Drag & drop:
  - slot → slot = swap
  - foto disponible → slot = replace
- Panel de textos editable (override onBlur).
- Botón “Regenerar preview” (deshabilitado en RENDERING).
- Botón “Exportar final” (solo APPROVED_FOR_EXPORT + preview READY).
- Polling:
  - Preview: cada 4s si `previewStatus=RENDERING`.
  - Export: cada 5s si `exportStatus=EXPORTING`.

## Logs estructurados

Prefijos reales encontrados en código:

- `[school_redeem_design_gate]`
- `[school_redeem_design_revision]`
- `[school_redeem_render_preflight]`
- `[school_design_review]`
- `[school_design_editor]`
- `[school_design_preview_job]`
- `[school_design_preview_poll]`
- `[school_design_preview]`
- `[school_design_export]`

## Diferencias detectadas entre documentación previa y código real

1. **Export PDF**: se planificó como opcional, pero **no está implementado** (solo JPG).
2. **markExportStarted/markExportCompleted** existen en `design-review.ts` pero **no se usan** en el pipeline actual de export (la transición la hace el worker).
3. **template-preflight.ts** existe, pero **no está integrado** al flujo principal del canje escolar (la validación real está en `redeem-preventa-pack-order-v1.ts`).
4. **Export status** se persiste en `DesignRevision.dataJson`, no en tabla aparte.

## Riesgos / pendientes

- Export final no genera PDF.
- `renderDesignExport` reutiliza renderer de preview (no pipeline de impresión real).
- No hay validación estricta de DPI o tamaño final para imprenta.
- `DesignExportJob` tiene dedupe por `(designRevisionId, status)` → puede dejar jobs FAILED históricos; ok pero requiere limpieza futura si crece.

## Checklist de réplica al monorepo

### Schema / Migraciones
- Copiar enums y modelos: `TemplateSlotRole`, `SelectionPhotoRole`, `DesignProjectStatus`, `PreviewJobStatus`, `ExportJobStatus`.
- Copiar tablas: `Selection`, `SelectionPhoto`, `DesignProject`, `DesignRevision`, `DesignPreviewJob`, `DesignExportJob`.
- Migraciones: `20260408150000_school_template_roles`, `20260408183000_design_review_status`, `20260408200000_design_preview_jobs`, `20260408212000_design_export_jobs`.

### Selección → diseño
- `lib/preventa-canjeable/redeem-preventa-pack-order-v1.ts`.
- Validar persistencia de `Selection`/`SelectionPhoto`.

### Template / validaciones
- `resolveDesignTemplateForRedeemItem`
- `validateSelectionAgainstTemplate`
- (Opcional) `template-contract.ts` + `template-preflight.ts` si se integra luego.

### Mapping + DesignRevision
- `buildInitialTemplateSlotAssignments`
- `buildInitialRenderPreflight`
- `buildRevisionDataJson` con `schemaVersion=3`.

### Review statuses
- `lib/school-render/design-review.ts` + endpoints approve/reject/regenerate.

### Editor manual
- `lib/school-render/design-editor.ts`
- Endpoints slot/replace/swap/text.
- UI `app/dashboard/design-projects/[id]/page.tsx`.

### Preview renderer
- `lib/school-render/preview-renderer.ts` (`renderDesignPreview`).

### Preview jobs + polling
- `DesignPreviewJob`
- `POST /design-revisions/[id]/regenerate-preview`
- `GET /design-revisions/[id]/preview-status`
- `GET /api/cron/process-design-previews`
- Polling UI.

### Export jobs + polling
- `DesignExportJob`
- `POST /design-projects/[id]/export`
- `GET /design-revisions/[id]/export-status`
- `GET /api/cron/process-design-exports`
- Polling UI.

### Dashboard / UI
- `app/dashboard/design-projects/[id]/page.tsx`
- Card de preview + editor + export.

## Archivos clave (legacy)

- `lib/preventa-canjeable/redeem-preventa-pack-order-v1.ts`
- `lib/school-render/design-review.ts`
- `lib/school-render/design-editor.ts`
- `lib/school-render/preview-renderer.ts`
- `lib/school-render/template-contract.ts`
- `lib/school-render/template-preflight.ts`
- `app/api/dashboard/design-projects/[id]/approve/route.ts`
- `app/api/dashboard/design-projects/[id]/reject/route.ts`
- `app/api/dashboard/design-projects/[id]/regenerate/route.ts`
- `app/api/dashboard/design-projects/[id]/export/route.ts`
- `app/api/dashboard/design-projects/[id]/editor/route.ts`
- `app/api/dashboard/design-revisions/[id]/slot-transform/route.ts`
- `app/api/dashboard/design-revisions/[id]/reset-slot-transform/route.ts`
- `app/api/dashboard/design-revisions/[id]/swap-slots/route.ts`
- `app/api/dashboard/design-revisions/[id]/replace-photo/route.ts`
- `app/api/dashboard/design-revisions/[id]/text-override/route.ts`
- `app/api/dashboard/design-revisions/[id]/regenerate-preview/route.ts`
- `app/api/dashboard/design-revisions/[id]/preview-status/route.ts`
- `app/api/dashboard/design-revisions/[id]/export-status/route.ts`
- `app/api/cron/process-design-previews/route.ts`
- `app/api/cron/process-design-exports/route.ts`
- `app/api/cron/cleanup-disenador/route.ts`
- `app/dashboard/design-projects/[id]/page.tsx`
- `prisma/schema.prisma`
- `prisma/migrations/20260408150000_school_template_roles/migration.sql`
- `prisma/migrations/20260408183000_design_review_status/migration.sql`
- `prisma/migrations/20260408200000_design_preview_jobs/migration.sql`
- `prisma/migrations/20260408212000_design_export_jobs/migration.sql`

