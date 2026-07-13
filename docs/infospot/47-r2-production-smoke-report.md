# 47 — R2 production smoke report

**Estado de etapa (22H):** **`COMPLETE`** — ciclo multimedia verificado; gate [`50-multimedia-production-gate.md`](./50-multimedia-production-gate.md)  
**Estado (22G):** smoke Production **PASS** · `R2_STATUS = VERIFIED_WORKING`  
**Histórico bloqueos:** 22F `BLOCKED_SECRET_NOT_EXPORTABLE` · 22E/22D `BLOCKED_BY_VERCEL_ENV` · 22B/22C `BLOCKED_BY_MANUAL_R2_TOKEN`

**Production alias:** `https://infospot-dnxsuite.vercel.app`  
**Commit smoke / Production:** **`fa55a2d`** · deployment `dpl_9Br5hao77qMeTxrGzXBjSmdUWabY` · health `db:ok`  
**Bucket:** `infospot-media` · público `pub-3cc4a4641be54ab9aeca101179467a60.r2.dev`

No incluye secretos. **No se re-ejecutó smoke en 22H** (evidencia 22G + reconfirmación 404).

---

## 1. Resultado 22G / verificación 22H

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

## 2. Residuos 22F

| Key | Estado final |
|-----|----------------|
| `infospot/covers/34c16c95-ffac-4cc0-b6c6-782929130756-infospot_r2_smoke.jpg` | **DELETED** |
| `infospot/editorial/clf/smoke-22f-1783939581621/w128.webp` | **DELETED** |
| `infospot/editorial/clf/smoke-22f-1783939581621/w128.jpg` | **DELETED** |

En 22G: `existedBefore: true` al borrar. En 22H: GET público **404**.

---

## 3. Runtime (logs Production ventana smoke)

Secuencia observada sin 500: login → cleanup 422/200 → upload 201 → cobertura + retry → cleanup 200×2. Crons posteriores 200. Health 200.

**Nota:** un log truncado `prisma:er…` en health fuera de la ventana crítica no invalidó `db:ok`.

---

## 4. Medición

| Ítem | Valor |
|------|--------|
| Fixture | 160×120 JPEG ~12 KB |
| Anchos derivados | Solo **160** (sin 640–1920 — esperado) |
| Ventana derivados (aprox. logs) | ~13 s |
| Pipeline | **`APTO_CON_LIMITACIONES`** — sync OK; worker no obligatorio pre-lanzamiento alias |

---

## 5. Histórico (bloqueos previos)

Las secciones 22B–22F documentaron keys S3 con `updatedAt` antiguo y secretos no exportables entre proyectos. **Quedan como historial:** el smoke 22G demostró Put/Get/Delete reales en Production con las credenciales vigentes (`VERIFIED_WORKING`), independientemente del timestamp de panel.

Auditoría cross-project: [`48-r2-cross-project-credential-audit.md`](./48-r2-cross-project-credential-audit.md).  
Lifecycle: [`49-r2-object-lifecycle-and-cleanup.md`](./49-r2-object-lifecycle-and-cleanup.md).

---

## 6. Confirmaciones

- Google Cloud **no** configurado.  
- `infospot.com.ar` **no** lanzado públicamente.  
- No se imprimieron secretos.  
- Originales CLF **no** borrados.  
- Smoke **no** republished / no import masivo.
