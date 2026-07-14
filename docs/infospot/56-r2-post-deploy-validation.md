# 56 — R2 post-deploy validation (Etapa 22G re-run tras rotación)

**Fecha:** 2026-07-14  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Estado de etapa:** **`COMPLETE`**  
**R2_STATUS:** **`VERIFIED_WORKING`** (post credential rotation)  
**Alias:** `https://infospot-dnxsuite.vercel.app`  
**Deployment:** `dpl_F8uop3SQc7aCbEiet59KC2TLjPs1` · Ready · `2026-07-14T00:07:31.944Z`  
**Commit servido:** `3d0cd77` (redeploy Production tras actualizar keys)  
**Health:** `status=ok` · `db=ok`

No incluye secretos. Google Cloud **no** configurado. `infospot.com.ar` **no** lanzado públicamente.

Informe histórico previo: [`47-r2-production-smoke-report.md`](./47-r2-production-smoke-report.md).  
Lifecycle: [`49-r2-object-lifecycle-and-cleanup.md`](./49-r2-object-lifecycle-and-cleanup.md).  
Gate multimedia: [`50-multimedia-production-gate.md`](./50-multimedia-production-gate.md).

> Nota: el número **49** ya documenta lifecycle; este informe post-deploy usa **56**.

---

## 1. Variables R2 (Production) — solo presencia / updatedAt

| Variable | Estado | updatedAt (UTC) |
|----------|--------|-----------------|
| `R2_ACCESS_KEY_ID` | PRESENTE | `2026-07-14T00:05:00.719Z` |
| `R2_SECRET_ACCESS_KEY` | PRESENTE | `2026-07-14T00:05:37.157Z` |
| `R2_ACCOUNT_ID` | PRESENTE | `2026-07-13T09:10:24.299Z` |
| `R2_BUCKET_NAME` | PRESENTE | `2026-07-13T09:10:28.317Z` |
| `R2_ENDPOINT` | PRESENTE | `2026-07-13T09:10:32.152Z` |
| `R2_PUBLIC_URL` | PRESENTE | `2026-07-13T09:10:36.365Z` |

Cutoff histórico (`2026-07-11T23:22:49Z` / `23:22:53Z`): **superado** por Access Key y Secret → smoke **autorizado** (no `BLOCKED_BY_VERCEL_ENV`).

Deployment creado **después** de las keys (`00:05:44Z` → Ready `00:07:31Z`).

---

## 2. Smoke R2 (cliente real vía Production)

Ejecutado contra el runtime Production (upload / cleanup / retry derivados). Usuario técnico temporal creado y **eliminado** al finalizar.

| Paso | Resultado | Evidencia |
|------|-----------|-----------|
| Upload cover pequeño (~12 KB) | PASS | `POST /api/redaccion/upload` **201** · ~830 ms |
| Lectura pública exacta | PASS | GET r2.dev **200** · bytes idénticos al fixture |
| Content-Type | PASS | `image/jpeg` / `image/webp` según objeto |
| Cache-Control | OBSERVADO | Header **ausente** en delivery r2.dev (PutObject no setea CC) |
| URL pública | PASS | `pub-3cc4a4641be54ab9aeca101179467a60.r2.dev` · HTTPS |
| CORS OPTIONS | PASS | **204** · `ACAO=https://infospot-dnxsuite.vercel.app` |
| CORS GET | PASS | `ACAO` presente con `Origin` del alias |
| Delete (12 keys) | PASS | `existedBefore: true` · `deleted: true` |
| Delete idempotente | PASS | `existedBefore: false` ×12 |
| 404 post-delete | PASS | 12/12 **404** |
| Rechazo namespace CLF | PASS | `albums/…` → **422** |
| Cleanup sin sesión | PASS | **401** |

Texto plano `.txt` en path `smoke/production-readiness/…`: no subido vía API (solo imágenes) ni vía DNX-MCP (faltan `R2_*` S3 en MCP). El ciclo Put/Get/Delete + comparación exacta se validó con fixture JPEG técnico.

---

## 3. Pipeline de derivados

Fuente técnica 2048×1365 (no foto de usuario). Procesado en Production (`retryEditorialDerivative` · ~3.6 s) → `READY`.

| Ancho | WebP | JPEG | Dimensiones | Ratio |
|-------|------|------|-------------|-------|
| 640 | sí | sí | 640×426 | ~1.50 |
| 960 | sí | sí | 960×640 | 1.50 |
| 1280 | sí | — | 1280×853 | ~1.50 |
| 1920 | sí | sí | 1920×1280 | 1.50 |

- Sin ampliación artificial (`no_upscale=true`).
- Namespace: `infospot/editorial/clf/smoke-22g-post-{stamp}/w{N}.{webp|jpg}` (idempotente).
- EXIF: fixture sin EXIF; pipeline `sharp().rotate()` sin `withMetadata` (strip por diseño).
- Retry forzado `FAILED` → `READY` sin quedar `PROCESSING`.

---

## 4. Medición y worker

| Ítem | Valor |
|------|--------|
| Upload pequeño | ~0.7–0.95 s |
| Upload grande (~46 KB JPEG) | ~0.74 s |
| 3 uploads consecutivos | ~2.3 s total |
| Derivados (sync Production) | ~3.6 s wall |
| Riesgo timeout Vercel | Bajo para este tamaño |

**Decisión:** **`APTO_SINCRONICO`** — worker no obligatorio antes del go del alias. No se implementó worker.

---

## 5. Seguridad

- Home / health / JSON de upload: **sin** `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `DATABASE_URL`, endpoint privado ni headers Authorization.
- View model de derivados: URLs públicas r2.dev; `sourceStorageKey` no expuesto al cliente.
- Originales CLF (`albums/`) no tocados.

---

## 6. Previews editor (Biblioteca Material)

**`PENDING_AUTHENTICATED_SMOKE`** — no se abrió UI `/redaccion/asistente` con Director operador real ni se publicó nota. Smoke técnico R2/API sí ejecutado y limpiado.

---

## 7. Crons

| Endpoint | Sin secret | Con secret |
|----------|------------|------------|
| `/api/cron/clf-events-sync` | **401** `unauthorized` | No re-probado (valor `sensitive` no exportable por CLI/API) |
| `/api/cron/reconcile-public-coverage` | **401** `unauthorized` | Idem |

Sin 500. Sin secretos en cuerpo.

---

## 8. CLF readonly

- Dry-run sync eventos `--limit 3`: `dryRun=true`, `created=0`, mensajes “Dry-run: actualizaría…”.
- Lectura 3 álbumes + 3 eventos: OK, `writes=0`, slugs públicos presentes.
- Sin provisioning outbound.

---

## 9. Cleanup

- 12 objetos R2 eliminados; GET público **404**.
- Coverage / editorial photo / variantes / usuario smoke / sesión eliminados.
- Fixtures locales en `/tmp` (no versionados).

---

## 10. Validaciones técnicas (local)

| Check | Resultado |
|-------|-----------|
| `test:r2-cleanup` | OK |
| `test:editorial-photos` | OK |
| `test:editorial-photo-previews` | OK |
| `test:coverage` | OK |
| `test:public-coverage` | OK |
| `test:clf-event-sync` | OK |
| lint | OK |
| Prisma validate | OK |
| Prisma migrate status (Production) | 1 migración **pendiente** ajena: `20260714010000_dnx_public_profiles_and_infospot_preferences` (**no aplicada** en esta etapa) |
| `check-types` / `build` | **FAIL** por tipos `DnxPublicProfile*` (misma migración pendiente; fuera de alcance 22G) |

---

## 11. Confirmaciones

- Google Cloud **no** configurado.  
- `infospot.com.ar` **no** lanzado públicamente (alias Vercel únicamente para smoke).  
- No se imprimieron secretos.  
- No se modificó Prisma schema / workflow / UX / sync CLF.
