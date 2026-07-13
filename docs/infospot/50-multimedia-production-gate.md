# 50 — Multimedia production gate (Etapa 22H)

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Estado del gate multimedia:** **`COMPLETE`**  
**R2_STATUS:** **`VERIFIED_WORKING`** (ciclo Upload → Read → Derivados → Delete → Not Found)  
**Smoke verificado:** Etapa **22G** (no re-ejecutado en 22H; evidencia suficiente)  
**Launch Readiness (alias Vercel):** **~94%**  
**Dominio propio `infospot.com.ar`:** **NO-GO** (DNS / canónicos / OAuth / Search Console / Director)

No incluye secretos.

Ver también: [`47-r2-production-smoke-report.md`](./47-r2-production-smoke-report.md), [`49-r2-object-lifecycle-and-cleanup.md`](./49-r2-object-lifecycle-and-cleanup.md), [`43-launch-readiness.md`](./43-launch-readiness.md).

---

## 1. Deployment probado

| Ítem | Valor |
|------|--------|
| Alias | `https://infospot-dnxsuite.vercel.app` |
| Deployment Production | `dpl_9Br5hao77qMeTxrGzXBjSmdUWabY` |
| Estado | **Ready** |
| Commit servido | **`fa55a2d`** (`feat(infospot): add safe idempotent R2 delete…`) |
| Health | `status=ok`, **`db:ok`**, `version=fa55a2d` |
| HEAD local/remoto (rama) | `b24fbe4` (CLF admin post-login; **no** promovido a Info Spot Production) |
| Working tree ajeno | `apps/compramelafoto/.gitignore` — **no mezclado** |

Confirmación 22H: `GET /api/health` → `version=fa55a2d`. Production sigue en el deploy del smoke 22G.

---

## 2. Matriz smoke 22G (evidencia)

Fixture: JPEG técnico 160×120 (~12 KB). Namespace: `infospot/*` únicamente.

| Fase | Resultado | Evidencia |
|------|-----------|-----------|
| Upload | **PASS** | `POST /api/redaccion/upload` → **201**; key `infospot/covers/40023359-2a2d-49d2-9700-3c5df63ecff7-infospot_22g_smoke.jpg` |
| HeadObject | **PASS** | Delete API reportó `existedBefore: true` antes de borrar (implícito Head) |
| GetObject | **PASS** | Pipeline derivados leyó el original server-side (estado `READY`) |
| Lectura pública | **PASS** | `GET` r2.dev → **200**, size 11970 bytes, JPEG 160×120 |
| WebP | **PASS** | `w160.webp` (4254 B) · lectura pública **200** en smoke |
| JPEG fallback | **PASS** | `w160.jpg` (6205 B) · lectura pública **200** en smoke |
| Delete original | **PASS** | `DeleteObject` cover · `existedBefore: true` · `deleted: true` |
| Delete WebP | **PASS** | Idem variante WebP |
| Delete JPEG | **PASS** | Idem variante JPEG |
| Segundo delete | **PASS** | Idempotente · `existedBefore: false` · `ok: true` |
| Verificación 404 | **PASS** | Cover + derivados → **404** (reconfirmado 22H) |
| Cleanup DB | **PASS** | Usuario smoke, roles, coverage, photo, variants, asset eliminados |
| Cleanup R2 | **PASS** | Sin residuos 22F/22G (GET público **404**) |

Logs Vercel Production (ventana smoke ~14:14–14:15 ART):

- `POST /api/auth/login` 307  
- `POST /api/redaccion/r2-cleanup` 422 (rechazo CLF) → 200 (limpieza 22F)  
- `POST /api/redaccion/upload` **201**  
- `POST /redaccion/coberturas/…` **200** (retry derivados)  
- `POST /api/redaccion/r2-cleanup` **200** ×2 (delete + idempotente)  
- Sin **500** / timeout / unhandled rejection en esa ventana

---

## 3. Upload

- Key bajo `infospot/covers/` (namespace allowlist).  
- Content-Type `image/jpeg` (multipart upload).  
- Tamaño ~12 KB.  
- PutObject exitoso (201 + URL pública).  
- Sin keys fuera de `infospot/*`.  
- Sin secretos en respuestas JSON de smoke.

---

## 4. Read

- Lectura pública vía `R2_PUBLIC_URL` (r2.dev).  
- Integridad: descarga 11970 B coincidente con fixture.  
- Content-Type imagen JPEG en objeto.  
- Sin `ERR_NAME_NOT_RESOLVED`, sin 403 inesperado en objetos propios.  
- URL pública (no privada / no signed-only).  
- Storage key no expuesta en UI pública del smoke (API asset URL solo).

---

## 5. Derivados

| Ítem | Resultado |
|------|-----------|
| WebP + JPEG | Generados |
| Dimensiones | **160** (ancho fuente 160) |
| Aspect ratio | 160×120 (= 4:3 del fixture) |
| Ampliación artificial | No (no hay 640/960/1280/1920 — **esperado** para fixture pequeño) |
| Estado | `processStatus: READY` |
| Paths | `infospot/editorial/clf/smoke-22g-…/w160.{webp,jpg}` idempotentes por ancho |
| EXIF | Pipeline editorial strippea EXIF en derivados (código processing); fixture fuente tenía EXIF mínimo sips |

---

## 6. Delete / idempotencia / seguridad operativa

- API `POST /api/redaccion/r2-cleanup` — **no pública** (401 sin sesión; solo Dirección).  
- Keys validadas server-side (`assertInfoSpotDeletableR2Key`).  
- Rechazo CLF: `albums/…` → **422** con mensaje de namespace.  
- Sin borrado por prefijo; máx. 32 keys.  
- Modes: `keys` | `editorialPhoto` | `asset` (keys desde DB cuando aplica).  
- `collectEditorialPhotoInfoSpotKeys` **omite** `sourceStorageKey` CLF (`photo-variants/`, `albums/`).

---

## 7. Residuos 22F (estado final 22H)

| Key | Clasificación 22H |
|-----|-------------------|
| `infospot/covers/34c16c95-ffac-4cc0-b6c6-782929130756-infospot_r2_smoke.jpg` | **DELETED** (22G `existedBefore:true` → ahora GET **404**) |
| `infospot/editorial/clf/smoke-22f-1783939581621/w128.webp` | **DELETED** |
| `infospot/editorial/clf/smoke-22f-1783939581621/w128.jpg` | **DELETED** |

Keys smoke 22G (cover + w160 webp/jpg): **DELETED** / GET **404**.

---

## 8. Seguridad (tests + runtime)

Cubierto por `r2-cleanup.test.ts` + smoke:

| Control | Estado |
|---------|--------|
| Key vacía | Rechazada |
| Traversal `..` | Rechazado |
| URL completa | Rechazada |
| Key externa / CLF | Rechazada |
| Prefijo sin objeto owned | Rechazado |
| Actor sin permiso | 401 / 403 |
| Endpoint público de delete | Inexistente |
| Cliente no envía storageKey libre al delete de producto | Keys validadas / resueltas en servidor |
| Originales CLF / usages compartidos | Protegidos (omit source CLF; quitar usage ≠ delete R2) |

No aparecieron `DATABASE_URL`, `R2_SECRET_ACCESS_KEY`, `R2_ACCESS_KEY_ID` ni headers Authorization en docs/logs revisados.

---

## 9. Medición y worker

| Métrica | Evidencia |
|---------|-----------|
| Upload | Request único ~14:14:53 → 201 (sin instrumentación ms en app) |
| Derivados | ~14:14:57 GET cobertura → ~14:15:10 POST retry (~13 s ventana; fixture tiny) |
| Delete | ~14:15:17–19 (dos llamadas 200) |
| Memoria | No instrumentada |

**Clasificación pipeline:** **`APTO_CON_LIMITACIONES`**

- Sincrónico OK para fixtures / originales pequeños-medianos editoriales.  
- Sin evidencia de originales grandes (multi-MB / muchos anchos).  
- **No** se exige worker antes del lanzamiento en alias Vercel.  
- Worker sigue en plan futuro ([`29-jobs-and-workers-plan.md`](./29-jobs-and-workers-plan.md)) si aparecen timeouts en producción real.

---

## 10. Validaciones 22H (sin cambio de código)

| Check | Resultado |
|-------|-----------|
| `test:r2-cleanup` | OK |
| `test:editorial-photos` | OK |
| `test:coverage` | OK |
| `test:public-coverage` | OK |
| `test:editorial-photo-previews` | OK |
| lint Info Spot | OK |
| typecheck Info Spot | OK |
| build Info Spot | OK |
| `prisma validate` | OK |
| `prisma migrate status` (Neon prod) | **2 migraciones CLF gap pendientes** (no aplicadas en 22H; ver bloqueantes) |

---

## 11. Bloqueantes restantes (no multimedia)

1. DNS / SSL / canónicos DonWeb → `infospot.com.ar`  
2. OAuth redirect día D (Google Cloud console URI)  
3. Search Console  
4. Seed Director (primer usuario real)  
5. (Opcional) Resend / GA4  
6. **Migraciones Prisma pendientes en Neon prod** (gaps CLF del monorepo; fuera del ciclo R2 — aplicar en etapa dedicada, no en 22H)

**Multimedia R2 ya no es bloqueante.**

---

## 12. Decisión

| Pregunta | Respuesta |
|----------|-----------|
| ¿Ciclo multimedia Production cerrado? | **Sí** |
| ¿Repetir smoke 22H? | **No** (evidencia 22G + reconfirmación 404/health) |
| ¿Worker obligatorio pre-lanzamiento? | **No** |
| ¿GO dominio propio? | **No** |
| ¿GO operativo alias Vercel (media)? | **Sí** |
