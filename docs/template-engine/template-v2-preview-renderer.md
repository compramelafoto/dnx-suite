# Template V2 — Preview PNG Server (P0-05)

## Arquitectura

```text
POST /api/template-v2/preview
  → auth + autorización
  → parse request (draft | templateId)
  → parseTemplateV2EditorPayload / getTemplateV2Detail
  → validateLegacyTemplatePayload + bridge (@repo/template-engine)
  → resolveSchoolTemplateDocument (registry escolar)
  → build HTML/CSS aislado
  → Chromium headless (playwright-core)
  → PNG binario
```

Capa de render (infra CLF, agnóstica de Prisma en el núcleo HTML/CSS):

```text
apps/compramelafoto/lib/template-v2/rendering/
  template-v2-preview-service.ts
  template-v2-preview-renderer.ts
  template-v2-html-builder.ts
  template-v2-css-builder.ts
  template-v2-font-resolver.ts
  template-v2-asset-resolver.ts
  template-v2-browser-manager.ts
  template-v2-render-errors.ts
  template-v2-render-limits.ts
  create-template-preview-example-data.ts
```

`@repo/template-engine` permanece sin dependencias de browser/filesystem.

Selección de plugin por `draft.meta.product` (`school` | `clickaton`) vía `resolveTemplateVariablePlugin` + `createExampleDataForProduct`.

## Decisión de motor

**Playwright Chromium (`playwright-core`)** — fidelidad DOM/CSS alineada al editor V2.

| Opción | Veredicto |
|---|---|
| Chromium headless | **Elegido** — object-fit, tipografía, rotación, bordes |
| Sharp directo | Descartado — reconstruir layout a mano diverge del editor |
| SVG intermedio | Descartado para V1 — no cubre todo el CSS actual |

No se usa Konva/Fabric/Pixi. No se toca el pipeline Sharp → JPEG escolar.

## Contrato HTTP

```http
POST /api/template-v2/preview
Content-Type: application/json
Accept: image/png
```

Request:

```ts
{
  draft?: { canvas, blocks, variableBindings, meta? }, // precedencia 1
  templateId?: string,                                 // precedencia 2
  versionId?: string,
  data?: Record<string, unknown>,
  mockData?: Record<string, unknown>,                  // compat editor
  previewPageIndex?: number,
  output?: { format?: "png"; scale?: number }
}
```

Response OK:

```http
200 image/png
Cache-Control: no-store
Content-Disposition: inline; filename="template-preview.png"
X-Template-Preview-Width
X-Template-Preview-Height
X-Template-Preview-Duration-Ms
X-Template-Preview-Block-Count
X-Template-Preview-Warning-Count
```

Si `Accept: application/json` → `{ ok, imageBase64, mimeType, width, height, warnings }` (compat).

Errores JSON: `{ ok:false, error, code?, details? }`.

| code | HTTP |
|---|---|
| TEMPLATE_UNAUTHORIZED | 401 |
| TEMPLATE_FORBIDDEN / NOT_FOUND | 403 / 404 |
| TEMPLATE_PAYLOAD_TOO_LARGE | 413 |
| TEMPLATE_PREVIEW_INVALID / ASSET_FAILED / LIMIT_EXCEEDED | 422 |
| TEMPLATE_PREVIEW_BUSY | 429 |
| TEMPLATE_PREVIEW_UNAVAILABLE | 503 |
| TEMPLATE_PREVIEW_TIMEOUT | 504 |

## Bloques soportados

`BACKGROUND`, `PHOTO`, `TEXT`, `VARIABLE_TEXT`, `IMAGE`, `SHAPE` (rectángulo / círculo-elipse).

Sistema de coordenadas: `position:absolute`, `box-sizing:border-box`, `transform-origin:center center`.

## Variables

Registry escolar + `createTemplatePreviewExampleData()`. No consulta pedidos/alumnos reales.

## Assets

- Data URL: solo `image/png|jpeg|webp` bajo límite.
- HTTPS/HTTP remoto: bloquea localhost, IPs privadas, metadata, protocolos `javascript/file/ftp/blob`.
- V1 no hace fetch server-side de remotos; Chromium carga solo imágenes ya validadas.

## Fuentes

Allowlist (`Arial`, `Helvetica`, `DM Sans`, `Inter`, …). No descarga URLs de cliente. Fallback + warning.

## Seguridad

- Texto escapado; sin scripts; CSP `script-src 'none'`.
- Sin `dangerouslySetInnerHTML`.
- Colores CSS sanitizados.
- Context/page aislados por request; route abort de recursos no imagen.

## Límites (iniciales)

| Límite | Valor |
|---|---|
| width/height | 4000 |
| blocks | 300 |
| images | 50 |
| scale | 0.25–2 |
| timeout | 15 s |
| concurrencia | 2 |
| data URL | 1.5 MB |

## Browser manager

`getTemplatePreviewBrowser` / `closeTemplatePreviewBrowser` — singleton por proceso, context aislado, page siempre cerrada.

## Persistencia

V1 **no** guarda PNG en Prisma ni R2.

## Compatibilidad deploy

| Runtime | Estado |
|---|---|
| Local / CI con Playwright Chromium | **COMPATIBLE** |
| Vercel serverless (bundle + binario) | **REQUIERE WORKER EXTERNO** o `@sparticuz/chromium` + adapter |
| Container con Chromium instalado | **COMPATIBLE** |

El contrato HTTP se mantiene; en serverless sin Chromium responde `503 TEMPLATE_PREVIEW_UNAVAILABLE`.

## Diferencia vs render productivo escolar

| Preview V2 | School render legacy |
|---|---|
| Chromium → PNG | Sharp → JPEG |
| Draft editor | Pedido/album pack |
| No persiste | Persistencia de entrega |

## Tests

```bash
pnpm --filter compramelafoto test:template-v2-preview
pnpm --filter compramelafoto test:template-v2-preview:render
pnpm --filter compramelafoto test:e2e:template-v2
```

## Performance (local, orientativo)

Medir en máquina de desarrollo; valores varían.

| Métrica | Orden de magnitud esperado |
|---|---|
| Cold (primer launch) | 1–5 s |
| Warm | 200–1500 ms (canvas pequeño) |
| PNG simple 320×180 | decenas de KB |

Métricas logueadas (sin PII): `durationMs`, `blockCount`, `imageCount`, `width`, `height`, `success`, `errorCode`.
