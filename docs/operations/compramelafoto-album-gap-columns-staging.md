# ComprameLaFoto — Album gap columns (staging)

**Fecha:** 2026-07-09  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Migración:** `20260709150000_add_clf_album_gap_columns`  
**DB objetivo:** Neon staging `ep-round-fog-a4xgibtv` (preview)  
**Restricciones:** sin producción · sin DNS · sin deploy production

---

## Contexto

Preview `dpl_9YBMLoCzqwwWJJN2VrkXqe5bNq3j` (DB ya en `ep-round-fog`):

- Login **OK**
- Blog **OK**
- `GET /api/public/albums` **500** — `The column Album.cleanupStatus does not exist in the current database`

Prisma Client hidrata el modelo `Album` completo; falta `cleanupStatus` (y otras columnas del mismo modelo).

---

## Schema (`Album.cleanupStatus`)

| Campo | Valor |
| ----- | ----- |
| Tipo | `AlbumCleanupStatus` (enum) |
| Nullability | **NOT NULL** |
| Default | `NONE` |
| Índice | `@@index([cleanupStatus])` |

Enum `AlbumCleanupStatus`: `NONE`, `PENDING`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_REFERENCES`, `BLOCKED_PRINT`, `FAILED`.

---

## Auditoría staging (`ep-round-fog`) — columnas `Album` faltantes

Confirmado en vivo (53 columnas en DB vs 72 scalars en schema). **19** ausentes:

| Columna | Tipo | Default |
| ------- | ---- | ------- |
| `cleanupStatus` | `AlbumCleanupStatus` | `NONE` |
| `cleanupPendingAt` | `DateTime?` | null |
| `cleanupStartedAt` | `DateTime?` | null |
| `cleanupCompletedAt` | `DateTime?` | null |
| `cleanupLastError` | `String?` | null |
| `cleanupBlockReason` | `String?` | null |
| `cleanupPhotosProcessed` | `Int` | `0` |
| `mode` | `AlbumMode` | `SIMPLE` |
| `albumPackPayEnabled` | `Boolean` | `false` |
| `isTest` | `Boolean` | `false` |
| `academicYearId` | `Int?` | null |
| `selectedCourseKeys` | `Json?` | null |
| `enableFaceBulkPurchase` | `Boolean` | `false` |
| `faceBulkPriceCents` | `Int?` | null |
| `studentIdentificationMode` | `StudentIdentificationMode?` | null |
| `allowManualStudentFallback` | `Boolean` | `false` |
| `organizerCommissionEnabled` | `Boolean` | `false` |
| `organizerCommissionPercentage` | `Float?` | null |
| `organizerCommissionAppliesTo` | `OrganizerCommissionAppliesTo[]` | `[PREVENTA]` |

Enums creados si faltan: `AlbumCleanupStatus`, `AlbumMode`, `StudentIdentificationMode`, `OrganizerCommissionAppliesTo`.

**Nota:** no se crea tabla `AcademicYear` ni FK; `academicYearId` queda como `INTEGER` nullable sin constraint (tabla ausente en staging).

---

## Bloqueo previo en cadena de migraciones

En `ep-round-fog`, `20260708150000_organizer_direct_mp_commission_ledger` quedó fallida (`finished_at` null, `applied_steps_count=0`) porque el SQL original hacía `ALTER TYPE` sobre enums inexistentes.

Para poder aplicar el gap de Album:

1. SQL de `08150000` reescrito idempotente (crear enums/tablas si faltan).
2. `prisma migrate resolve --rolled-back 20260708150000_organizer_direct_mp_commission_ledger`
3. `prisma migrate deploy` (reaplica `08150000` + pendientes posteriores, incluida `09150000` Album)

---

## Migración

`packages/db/prisma/migrations/20260709150000_add_clf_album_gap_columns/migration.sql`

- `IF NOT EXISTS` / `DO $$ … EXCEPTION WHEN duplicate_object`
- Defaults seguros; datos existentes preservados
- Solo modelo `Album` (+ enums necesarios)

---

## Aplicación / verificación

| Check | Resultado |
| ----- | --------- |
| `prisma validate` | OK |
| `compramelafoto` typecheck | TBD |
| `compramelafoto` build | TBD |
| `compramelafoto` lint | TBD |
| `prisma migrate deploy` (staging `ep-round-fog`) | TBD |
| Columnas agregadas | 19 (lista arriba) |
| `GET /api/public/albums` (antes) | Error 500 (`cleanupStatus`) |
| `GET /api/public/albums` (después) | TBD |
| Home muestra álbumes | TBD |
| `/a/staging-clf-demo-album` | TBD |
