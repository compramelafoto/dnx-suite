# Template V2 API Map — P0-03

**Fecha:** 2026-08-01  
**App:** `apps/compramelafoto`

## Resumen

Antes de P0-03: **0** rutas bajo `app/api/template-v2/**` (solo admin). El editor y dashboards ya llamaban ~10 endpoints ausentes.

Tras P0-03: superficie canónica + aliases de compatibilidad del editor, con capa de servicio y `@repo/template-engine`.

## Tabla de endpoints

| ENDPOINT | MÉTODO | ESTADO | CONSUMIDOR | AUTORIZACIÓN | ACCIÓN |
|---|---|---|---|---|---|
| `/api/template-v2/templates` | GET | **Restaurado** | Canónico / futuros | PHOTOGRAPHER, LAB_PHOTOGRAPHER, ADMIN | Listar (mine/public/all) |
| `/api/template-v2/templates` | POST | **Restaurado** | Canónico | Diseñador | Crear |
| `/api/template-v2/templates/create` | POST | **Restaurado** | `CreateTemplateV2Button` | Diseñador | Alias create vacío |
| `/api/template-v2/templates/[id]` | GET | **Restaurado** | Canónico | Read (owner/admin/public) | Detalle CORE+legacy |
| `/api/template-v2/templates/[id]` | PATCH | **Restaurado** | Canónico | Write owner/admin | Metadata / document |
| `/api/template-v2/templates/[id]` | DELETE | **Restaurado** | designs / escuelas | Write | Soft ARCHIVED si en uso; hard si no |
| `/api/template-v2/templates/[id]/duplicate` | POST | **Restaurado** | Canónico | Read source | Duplicar (IDs nuevos) |
| `/api/template-v2/templates/[id]/clone` | POST | **Restaurado** | packs / publicas / designs | Read source | Alias duplicate |
| `/api/template-v2/templates/[id]/validate` | POST | **Restaurado** | Canónico / client | Read | Validar sin persistir |
| `/api/template-v2/templates/[id]/versions` | GET | **Restaurado** | `TemplateVersionList` | Read | Listar versiones |
| `/api/template-v2/templates/[id]/versions/[vid]/save` | GET | **Restaurado** | `TemplateEditorShell` | Read | Cargar editor |
| `/api/template-v2/templates/[id]/versions/[vid]/save` | PUT | **Restaurado** | `TemplateEditorShell` | Write + revision | Guardar |
| `/api/template-v2/templates/[id]/versions/[vid]/image-upload` | POST | **Restaurado** | upload helper | Write | R2 + TemplateV2Asset |
| `/api/template-v2/templates/[id]/save-as-new-version` | POST | **Restaurado** | Editor shell | Write | Nueva versión |
| `/api/template-v2/templates/[id]/submit-for-review` | POST | **Restaurado** | PlantillasLegacyClient | Write | IN_REVIEW |
| `/api/template-v2/public` | GET | **Restaurado** | plantillas/publicas | Diseñador autenticado | Catálogo PUBLIC+APPROVED |
| `/api/template-v2/preview` | POST | **Stub 501** | Editor preview | Diseñador | Valida draft; PNG pendiente |
| `/api/admin/template-v2/review-queue` | GET | Existente | Admin UI | ADMIN | Sin cambios |
| `/api/admin/template-v2/.../approve` | POST | Existente | Admin UI | ADMIN | Sin cambios |
| `/api/admin/template-v2/.../reject` | POST | Existente | Admin UI | ADMIN | Sin cambios |

## Servicios Prisma usados

- `TemplateV2`, `TemplateV2Version`, `TemplateV2Block`, `TemplateV2VariableBinding`, `TemplateV2Asset`, `TemplateV2Publication`
- `AlbumPack` (conteo `templateV2Id` para delete seguro)
- `User` (autor en catálogo público)

## Verificación de permisos

- `requireAuth([PHOTOGRAPHER, LAB_PHOTOGRAPHER, ADMIN])`
- Helpers: `requireTemplateV2ReadAccess` / `requireTemplateV2WriteAccess`
- Privadas ajenas → **404** (no filtrado por 403)

## Decisiones

| Tema | Decisión |
|---|---|
| Assets R2 en duplicate | Se reutiliza `storageKey` (no copia física) |
| Delete en uso | Soft `ARCHIVED` |
| Delete libre | Hard delete filas; **no** borra objetos R2 |
| Preview PNG | 501 `PREVIEW_NOT_IMPLEMENTED` (fuera de alcance P0-03) |
| Concurrencia | `revision` en PUT save; `expectedUpdatedAt` opcional en PATCH |

## Rutas huérfanas / gaps

- Ninguna llamada editor queda sin route handler.
- Preview no genera `imageBase64` aún.
