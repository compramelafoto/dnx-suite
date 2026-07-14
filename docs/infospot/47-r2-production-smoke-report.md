# 47 — R2 production smoke report

**Estado de etapa (22G post-rotación 2026-07-14):** **`COMPLETE`** · `R2_STATUS = VERIFIED_WORKING`  
**Detalle post-deploy:** [`56-r2-post-deploy-validation.md`](./56-r2-post-deploy-validation.md)  
**Estado (22H):** gate multimedia **COMPLETE** · [`50-multimedia-production-gate.md`](./50-multimedia-production-gate.md)  
**Histórico bloqueos:** 22F `BLOCKED_SECRET_NOT_EXPORTABLE` · 22E/22D `BLOCKED_BY_VERCEL_ENV` · 22B/22C `BLOCKED_BY_MANUAL_R2_TOKEN`

**Production alias:** `https://infospot-dnxsuite.vercel.app`  
**Commit / deploy post-rotación:** **`3d0cd77`** · `dpl_F8uop3SQc7aCbEiet59KC2TLjPs1` · health `db:ok`  
**Bucket:** `infospot-media` · público `pub-3cc4a4641be54ab9aeca101179467a60.r2.dev`

No incluye secretos.

---

## 1. Resultado 22G post-rotación (2026-07-14)

| Fase | Resultado | Evidencia |
|------|-----------|-----------|
| Env keys frescas | PASS | Access/Secret `updatedAt` 2026-07-14T00:05:0xZ |
| Deploy Ready | PASS | `dpl_F8uop3SQ…` Ready 00:07:31Z |
| Upload | PASS | `POST /api/redaccion/upload` **201** |
| GetObject / lectura pública | PASS | GET r2.dev **200** · match exacto fixture |
| CORS | PASS | OPTIONS **204** · ACAO alias Vercel |
| Derivados 640–1920 WebP + JPEG | PASS | `READY` · ~3.6 s · ratio ~1.5 · sin upscale |
| Retry `FAILED`→`READY` | PASS | Idempotente |
| Delete + 404 | PASS | 12 keys · segundo delete `existedBefore:false` |
| Rechazo CLF / unauth cleanup | PASS | **422** / **401** |
| Cleanup DB | PASS | Sin residuos smoke |
| Worker | **`APTO_SINCRONICO`** | No implementado |
| Previews UI Director | `PENDING_AUTHENTICATED_SMOKE` | — |

---

## 2. Resultado 22G histórico / verificación 22H

| Fase | Resultado | Evidencia |
|------|-----------|-----------|
| Upload | PASS | `POST /api/redaccion/upload` **201** · key `infospot/covers/40023359-…-infospot_22g_smoke.jpg` |
| HeadObject | PASS | `existedBefore: true` en delete |
| GetObject | PASS | Derivados `READY` (lectura server-side del original) |
| Lectura pública | PASS | GET r2.dev **200** · 11970 B · JPEG 160×120 |
| WebP | PASS | `…/w160.webp` (fixture pequeño → solo 160; esperado) |
| JPEG fallback | PASS | `…/w160.jpg` |
| Delete original / WebP / JPEG | PASS | 3× `deleted: true` · `existedBefore: true` |
| Segundo delete | PASS | Idempotente · `existedBefore: false` |
| 404 post-delete | PASS | Cover + derivados **404** (reconfirmado 22H) |
| Cleanup DB | PASS | Filas smoke eliminadas |
| Cleanup R2 | PASS | Sin residuos 22F/22G |
| Rechazo CLF | PASS | `albums/…` → **422** |
| Cleanup sin sesión | PASS | **401** |

---

## 3. Residuos 22F

| Key | Estado final |
|-----|----------------|
| `infospot/covers/34c16c95-ffac-4cc0-b6c6-782929130756-infospot_r2_smoke.jpg` | **DELETED** |
| `infospot/editorial/clf/smoke-22f-1783939581621/w128.webp` | **DELETED** |
| `infospot/editorial/clf/smoke-22f-1783939581621/w128.jpg` | **DELETED** |

En 22G: `existedBefore: true` al borrar. En 22H: GET público **404**.

---

## 4. Runtime (logs Production ventana smoke)

Secuencia observada sin 500: login → cleanup 422/200 → upload 201 → cobertura + retry → cleanup 200×2. Crons posteriores 200. Health 200.

**Nota:** un log truncado `prisma:er…` en health fuera de la ventana crítica no invalidó `db:ok`.

---

## 5. Medición

| Ítem | Valor |
|------|--------|
| Fixture post-rotación | 2048×1365 + 160×120 técnicos |
| Anchos derivados | **640 / 960 / 1280 / 1920** (+ JPEG fallback) |
| Ventana derivados | ~3.6 s |
| Pipeline | **`APTO_SINCRONICO`** |

---

## 6. Histórico (bloqueos previos)

Las secciones 22B–22F documentaron keys S3 con `updatedAt` antiguo y secretos no exportables entre proyectos. **Cerrado** tras rotación 2026-07-14 + smoke post-deploy ([`56`](./56-r2-post-deploy-validation.md)).

Auditoría cross-project: [`48-r2-cross-project-credential-audit.md`](./48-r2-cross-project-credential-audit.md).  
Lifecycle: [`49-r2-object-lifecycle-and-cleanup.md`](./49-r2-object-lifecycle-and-cleanup.md).

---

## 7. Confirmaciones

- Google Cloud **no** configurado.  
- `infospot.com.ar` **no** lanzado públicamente.  
- No se imprimieron secretos.  
- Originales CLF **no** borrados.  
- Smoke **no** republished / no import masivo.
