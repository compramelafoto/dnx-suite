# Template V2 API Contract — P0-03

## Relación con `@repo/template-engine`

Flujo típico write:

```text
HTTP → auth → parse/limits → parseTemplateV2EditorPayload
  → bridge fromLegacyTemplateV2 / parseTemplateDocument
  → validateLegacyTemplatePayload (registry escolar)
  → Prisma transaction
```

Respuesta de detalle preferida:

```ts
{
  ok: true,
  template: TemplateDocument,      // CORE
  legacy?: EditorPayload,          // blocks/configJson para editor
  compatibilityWarnings: BridgeWarning[],
  meta: { templateId, name, status, versionId, revision, ... }
}
```

## Endpoints canónicos

### GET /api/template-v2/templates

Query: `page`, `pageSize`, `q`, `status`, `sort` (`updatedAt|createdAt|name`), `order`, `scope` (`mine|public|all`).

```ts
{ ok: true, items: TemplateSummary[], pagination: { page, pageSize, total, totalPages } }
```

### POST /api/template-v2/templates

Body: `{ name?, description?, payload? | document? }`  
Ownership = usuario autenticado (no acepta ownerUserId del cliente).

### GET /api/template-v2/templates/:id

Query: `legacy=0` para omitir payload editor.

### PATCH /api/template-v2/templates/:id

Body mapeado explícitamente: `name`, `description`, `status`, `document`, `expectedUpdatedAt`.

### POST .../duplicate | .../clone

Body opcional `{ name }`. Nombre default: `"Nombre — copia"`. Nuevos IDs de bloques/bindings.

### POST .../validate

No persiste. Body opcional = draft; si vacío, valida versión actual.

```ts
{ ok: true, valid, errors[], warnings[], normalizedTemplate? }
```

### DELETE .../:id

- Con `AlbumPack.templateV2Id` → `status=ARCHIVED` (`softDeleted: true`)
- Sin refs → hard delete DB (R2 intacto)

## Endpoints editor (compat)

| Path | Comportamiento |
|---|---|
| POST `/templates/create` | create vacío |
| GET/PUT `.../versions/:vid/save` | load / save + `revision` |
| POST `.../save-as-new-version` | nueva versión |
| POST `.../image-upload` | R2 + asset row |
| POST `.../submit-for-review` | publication IN_REVIEW |
| GET `/public` | catálogo APPROVED+PUBLIC |
| POST `/preview` | PNG real (Chromium); draft o `templateId` |

## Errores

| code | HTTP |
|---|---|
| TEMPLATE_UNAUTHORIZED | 401 |
| TEMPLATE_FORBIDDEN / TEMPLATE_PUBLISHED_LOCKED | 403 |
| TEMPLATE_NOT_FOUND | 404 |
| TEMPLATE_EDIT_CONFLICT / TEMPLATE_IN_USE | 409 |
| TEMPLATE_PAYLOAD_TOO_LARGE | 413 |
| TEMPLATE_INVALID / BINDING / ASSET / SCHEMA | 422 |
| TEMPLATE_PREVIEW_INVALID / ASSET_FAILED / LIMIT_EXCEEDED | 422 |
| TEMPLATE_PREVIEW_BUSY | 429 |
| TEMPLATE_PREVIEW_UNAVAILABLE | 503 |
| TEMPLATE_PREVIEW_TIMEOUT | 504 |
| PREVIEW_NOT_IMPLEMENTED | 501 (legacy; preview V2 ya no lo usa) |

Envelope: `{ ok: false, error, code?, details? }`.

## Concurrencia

- PUT save: body.`revision` debe coincidir con `TemplateV2Version.revision` → si no, `409 revision_conflict` + `currentRevision`.
- PATCH: opcional `expectedUpdatedAt` vs `TemplateV2.updatedAt`.

## Límites

Ver `TEMPLATE_V2_LIMITS` en `lib/template-v2/services/template-v2-limits.ts`:

- JSON ≤ 2MB
- ≤ 400 bloques / bindings
- canvas ≤ 20000×20000
- URLs `javascript:` / `data:` no imagen bloqueadas
- imagen upload ≤ 8MB

## Permisos

Fotógrafo/Lab/Admin. Lectura pública solo PUBLIC+APPROVED. Escritura solo owner o admin. Privadas ajenas → 404.

## Preview (P0-05)

Ver `docs/template-engine/template-v2-preview-renderer.md`.

```http
POST /api/template-v2/preview
→ 200 image/png  (Accept: image/png)
→ 200 JSON base64 si Accept: application/json
```

Precedencia: `draft` > `templateId` (+ `versionId` opcional).

## Campos / trabajo pendiente

- Migración UI a paths canónicos exclusivos
- Soft-delete con `deletedAt` (no existe en Prisma; se usa ARCHIVED)
- Variables / placas Clickatón
