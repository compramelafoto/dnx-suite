# ComprameLaFoto — Album gap columns (staging)

**Fecha:** 2026-07-09  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Commit:** `f52d3ea` — `fix(db): add clf album gap columns`  
**Migración:** `20260709150000_add_clf_album_gap_columns`  
**DB objetivo:** Neon staging `ep-round-fog-a4xgibtv` (preview)  
**Restricciones:** sin producción · sin DNS · sin deploy production

---

## Contexto

Preview previo (DB ya en `ep-round-fog`):

- Login **OK**
- Blog **OK**
- `GET /api/public/albums` **500** — `The column Album.cleanupStatus does not exist in the current database`

---

## Schema (`Album.cleanupStatus`)

| Campo | Valor |
| ----- | ----- |
| Tipo | `AlbumCleanupStatus` (enum) |
| Nullability | **NOT NULL** |
| Default | `NONE` |
| Índice | `@@index([cleanupStatus])` |

Enum: `NONE`, `PENDING`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_REFERENCES`, `BLOCKED_PRINT`, `FAILED`.

---

## Columnas agregadas (19)

`cleanupStatus`, `cleanupPendingAt`, `cleanupStartedAt`, `cleanupCompletedAt`, `cleanupLastError`, `cleanupBlockReason`, `cleanupPhotosProcessed`, `mode`, `albumPackPayEnabled`, `isTest`, `academicYearId`, `selectedCourseKeys`, `enableFaceBulkPurchase`, `faceBulkPriceCents`, `studentIdentificationMode`, `allowManualStudentFallback`, `organizerCommissionEnabled`, `organizerCommissionPercentage`, `organizerCommissionAppliesTo`

Enums creados: `AlbumCleanupStatus`, `AlbumMode`, `StudentIdentificationMode`, `OrganizerCommissionAppliesTo`.

**Nota:** `academicYearId` sin FK (tabla `AcademicYear` ausente en staging).

---

## Checks locales

| Check | Resultado |
| ----- | --------- |
| `prisma validate` | OK |
| `compramelafoto typecheck` | OK |
| `compramelafoto lint` | OK (0 errors, warnings preexistentes) |
| `compramelafoto build` | Compiló (Turbopack); TypeScript phase larga en disco externo |

---

## Aplicación staging

Bloqueo previo: migración fallida `20260708150000_organizer_direct_mp_commission_ledger` (P3009).  
Recuperación **solo staging**: SQL idempotente reaplicado + `migrate resolve` + `migrate deploy`.

| Check | Resultado |
| ----- | --------- |
| `prisma migrate deploy` (staging) | **OK** — `20260709150000_add_clf_album_gap_columns` applied |
| Demo row | `staging-clf-demo-album` → `cleanupStatus=NONE`, `isTest=false`, `mode=SIMPLE` |

---

## Preview post-migración

**URL:** https://compramelafoto-dnxsuite-jvckzqgp9-compramelafotos-projects.vercel.app  
**Deployment:** `dpl_6hE2cmriz2HfSk9p83qdf9qktkwR` (READY, preview, redeploy)

| Check | Resultado |
| ----- | --------- |
| `GET /api/public/albums` | **OK** 200 — 1 álbum (`Álbum demo staging CLF`) |
| Home `/` | **OK** 200 (shell); API de álbumes OK → home puede listar |
| `/a/staging-clf-demo-album` | Redirect 308 → `/album/staging-clf-demo-album` |
| `/album/staging-clf-demo-album` | **Error** 500 (digest `4229159332`) — **no** es `cleanupStatus` / no `P2022` en body; gap secundario de página álbum (otras tablas/campos) |

Producción no tocada.
