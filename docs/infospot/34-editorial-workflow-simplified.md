# ETAPA 15 — Workflow editorial simplificado

## Resumen del cambio

Simplificamos el flujo editorial visible de InfoSpot eliminando `READY_TO_PUBLISH` de la UX y el filtro `contentTag=REAL` de las superficies públicas.

## Estados visibles

| Estado | DB | Descripción |
|---|---|---|
| **Borrador** | `DRAFT` | En redacción, no visible públicamente |
| **En revisión** | `IN_REVIEW` | Enviado, esperando aprobación |
| **Publicado** | `PUBLISHED` | Visible en el sitio |
| **Despublicado** | `UNPUBLISHED` | Fue publicado, ahora oculto |
| **Archivado** | `ARCHIVED` | Fuera del flujo activo |

`READY_TO_PUBLISH` **permanece en el enum de Prisma** por compatibilidad de DB pero:
- Nunca se escribe desde código nuevo
- Se trata como alias de `IN_REVIEW` en toda la UI y lógica
- Fue migrado a `IN_REVIEW` vía SQL antes del deploy

## Acciones visibles

| Acción | Desde | Hacia | Permiso |
|---|---|---|---|
| Enviar a revisión | DRAFT | IN_REVIEW | cualquier redactor |
| **Publicar ahora** | DRAFT, IN_REVIEW, UNPUBLISHED | PUBLISHED | canPublish |
| Devolver con observación | IN_REVIEW | DRAFT | canPublish **o** isDirector |
| Despublicar | PUBLISHED | UNPUBLISHED | canPublish |
| Archivar | cualquiera | ARCHIVED | cualquier redactor |

`APPROVE` **ya no se ofrece en UI**. Es alias legado de `PUBLISH` → destino siempre `PUBLISHED`.

### Cambio clave: RETURN

Antes: solo el Director podía devolver contenido.  
Ahora: **cualquier actor con `canPublish` también puede devolver** (ETAPA 15).

### Cambio clave: Publicar ahora

El botón antes decía "Publicar". Ahora dice **"Publicar ahora"** para preparar la UI para "Programar publicación" (futuro).

## Visibilidad pública

Antes: `status=PUBLISHED AND contentTag=REAL`  
Ahora: **`status=PUBLISHED`** (sin filtro de contentTag)

El contenido DEMO que dependía del filtro para no aparecer fue despublicado vía migración SQL.

## ContentTag

- Los selectores de contentTag se ocultan de la UI de redacción
- El campo sigue existiendo en DB para seeds y smoke tests
- El checklist de publicación **ya no bloquea** por contentTag

## Migración SQL

Archivo: `packages/db/prisma/migrations/20260713030000_infospot_editorial_workflow_simplified/migration.sql`

```sql
-- Convertir READY_TO_PUBLISH → IN_REVIEW
UPDATE "InfoSpotArticle" SET status = 'IN_REVIEW' WHERE status = 'READY_TO_PUBLISH';
UPDATE "InfoSpotEvent"   SET status = 'IN_REVIEW' WHERE status = 'READY_TO_PUBLISH';

-- Despublicar DEMO que dependía del gate contentTag=REAL
UPDATE "InfoSpotArticle"
  SET status = 'UNPUBLISHED', "unpublishedAt" = COALESCE("unpublishedAt", NOW())
  WHERE status = 'PUBLISHED' AND "contentTag" = 'DEMO';

UPDATE "InfoSpotEvent"
  SET status = 'UNPUBLISHED', "unpublishedAt" = COALESCE("unpublishedAt", NOW())
  WHERE status = 'PUBLISHED' AND "contentTag" = 'DEMO';
```

**Ejecutar ANTES del deploy del código.** No toca producción si no hay filas afectadas.

## Archivos modificados

### Core
- `lib/editorial/types.ts` — `VISIBLE_EDITORIAL_*` exports, `normalizeVisibleEditorialStatus`
- `lib/editorial/editorial-workflow-core.ts` — lógica de transiciones, APPROVE→PUBLISHED, RETURN por canPublish
- `lib/editorial/editorial-status.ts` — labels READY→"En revisión", PUBLISH/APPROVE→"Publicar ahora"
- `lib/editorial/article-adapter.ts` — sin setContentTagReal, APPROVE→PUBLISHED
- `lib/editorial/event-adapter.ts` — idem, mapLegacy READY→IN_REVIEW

### Distribución
- `lib/distribution/public-rules.ts` — sin contentTag en where público
- `lib/distribution/queries.ts` — sin contentTag en banner y linkedOrigins
- `lib/launch-content.ts` — sin ítem "Contenido REAL" en checklist
- `lib/coverage/editorial-status.ts` — READY_TO_PUBLISH → IN_REVIEW

### Queries públicas
- `lib/articles.ts` — publicArticleWhere sin contentTag
- `lib/events.ts` — publicEventWhere sin contentTag
- `lib/public-coverage/resolver.ts` — filtros inline sin contentTag
- `app/sitemap.ts` — sin contentTag
- `app/actions/homepage-distribution.ts` — sin contentTag en validación de placement

### Colas y UI
- `lib/redaccion-queues.ts` — listas-publicar alias de en-revision; en-revision incluye READY_TO_PUBLISH
- `lib/redaccion-events.ts` — stats mergeados IN_REVIEW+READY
- `components/redaccion/editorial-actions-panel.tsx` — "Publicar ahora", sin APPROVE en UI
- `components/redaccion/status-badge.tsx` — READY_TO_PUBLISH = misma apariencia que IN_REVIEW

### Tests
- `lib/editorial/editorial-workflow.test.ts` — reescrito para ETAPA 15
- `lib/editorial/event-editorial-workflow.test.ts` — reescrito
- `lib/distribution/distribution.test.ts` — sin contentTag en regla pública
