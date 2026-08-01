# FotoRank P0-06 — Informe: carga privada, SHA-256, EXIF y checklist

**Fecha:** 2026-07-28  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Alcance:** FotoRank + `@repo/db` (schema/migración/seed). Sin commit, push ni deploy.

---

## 1. Diseño del dominio de obra

Entidad principal: `FotorankContestEntry` (ampliada).

- 1 inscripción → 1 obra (`registrationId` unique).
- Estados: `DRAFT` → `UPLOADED`/`PROCESSING` → `READY_TO_CONFIRM` | `REQUIRES_REVIEW` | `REJECTED` → `CONFIRMED` | `WITHDRAWN`.
- `activeAssetId` apunta al ORIGINAL activo.
- `entryNumber` anónimo generado al confirmar.
- `technicalSummaryStatus` + `technicalSummaryJson` (motor automático).
- `manualReviewStatus` + tabla `FotorankContestEntryReview` (decisión humana, no sobrescribe checks).

Carga solo si inscripción `CONFIRMED` y ventana de submission abierta.

---

## 2. Modelo de assets

`FotorankContestEntryAsset` versionado:

- `versionNumber`, `kind` (`ORIGINAL` | `THUMBNAIL` | `JURY_PREVIEW` | …), `isActive`
- `storageProvider`, `storageBucket`, `storageKey`, mime, dims, `sha256`
- Derivados referencian `sourceOriginalAssetId`
- Unique `(entryId, versionNumber, kind)`
- Reemplazo: nueva versión; anterior `isActive=false` + `replacedAt` (sin borrado físico)

---

## 3. Storage

Adapter local privado: `apps/fotorank/app/lib/fotorank/storage/private-local-storage.ts`

- Keys: `fotorank/contests/{contestId}/entries/{entryId}/versions/{n}/{kind}/{assetId}`
- Sin email/DNI/nombre en el path
- Sin URL pública permanente; acceso vía `/api/fotorank/private-asset` firmado (TTL corto)
- Directorio: `apps/fotorank/.data/` (gitignore)
- Preparado para swap a R2/S3 con la misma interfaz

---

## 4. Hash

- SHA-256 del buffer original (`hash.ts`)
- Índice `(contestId, sha256)`
- Misma inscripción + mismo hash activo → idempotencia
- Mismo concurso + otro entry → check `REQUIRES_REVIEW` (no rechazo automático)
- Global: no se expone identidad cruzada

---

## 5. EXIF

- `exifr` + entidad `FotorankContestEntryMetadata`
- Estados: `EXTRACTED` | `PARTIAL` | `NOT_AVAILABLE` | `INVALID` | `FAILED`
- **Regla:** ausencia de EXIF → `NOT_AVAILABLE` / WARNING; **nunca** FAIL automático solo por eso
- Heurística de dispositivo por categoría (`celular` / `camara` / `dron`) conservadora

---

## 6. Checklist

`FotorankContestEntryCheck` + motor `checklist.ts` (`ruleVersion = p0-06-v1`)

Grupos: FILE, REGISTRATION, CONTEST, CATEGORY, METADATA, DUPLICATE, SECURITY, TIMING.

Resumen:

| Condición | `technicalSummaryStatus` |
|-----------|--------------------------|
| ≥1 FAIL | `TECHNICALLY_REJECTED` |
| sin FAIL + REQUIRES_REVIEW | `REQUIRES_REVIEW` |
| sin FAIL + WARNING | `APPROVED_WITH_WARNINGS` |
| todo PASS | `APPROVED` |

`NOT_AVAILABLE` no es FAIL.

---

## 7. Confirmación

`POST .../entries/[entryId]/confirm`

- Bloquea si `TECHNICALLY_REJECTED` / `REJECTED`
- `REQUIRES_REVIEW` exige `acknowledgeWarnings`
- WARNING → permite confirmar (`READY_TO_CONFIRM`)
- Genera `entryNumber` (`{PREFIX}-E-000001`)

---

## 8. Reemplazo

`POST .../replace` o upload con flag replace

- Nueva versión ORIGINAL + derivados
- Requiere reconfirmación (`confirmedAt` null)
- Historial auditables

Retiro: `DELETE .../entries/[entryId]` → `WITHDRAWN` (sin borrar assets).

---

## 9. Panel organizador

- `/dashboard/concursos/[id]/inscripciones` — KPIs + tabla
- `/dashboard/concursos/[id]/inscripciones/[entryId]` — preview, checklist, EXIF, versiones, revisión manual
- Link desde `ContestDashboard`
- Authz: membership org del concurso

---

## 10. Permisos

| Actor | Puede | No puede |
|-------|-------|----------|
| Participante | su obra, checklist simplificado, confirm/replace/withdraw | obras ajenas, panel org, mutar checks |
| Organizador | listar/revisar sus concursos | concursos ajenos, mutar hash/EXIF |
| Jurado | (preparado) preview + código anónimo | identidad / original (no cableado aún) |

---

## 11. Migraciones

`packages/db/prisma/migrations/20260728140000_fotorank_p0_06_entry_upload_exif_checklist/`

No se modificó la migración P0-01.

Aplicación en test: `prisma db push` sobre `fotorank_p0_06_test` (ver runbook).  
**No** aplicada a Neon.

También: `FotorankContest.uploadPolicyJson`.

---

## 12. Tests

| Suite | Resultado |
|-------|-----------|
| `entries.selfcheck.ts` | PASS |
| `entries.integration.selfcheck.ts` (localhost `fotorank_p0_06_test`) | PASS |
| `tsc --noEmit` FotoRank | PASS |
| E2E `public-entry-upload.spec.ts` | escrito; requiere servidor + seed usuarios |

---

## 13. Problemas de entorno

- `packages/db/.env` apunta a Neon con drift → no usar para migrate
- Docker no disponible; Postgres Homebrew sí
- Lint app con `--max-warnings 0` falla por warnings **preexistentes** ajenos a P0-06

---

## 14. Riesgos

- Upload policy y bases con marcador **BORRADOR — VALIDAR ANTES DE PRODUCCIÓN**
- Storage local no es el adapter R2 de producción (interfaz lista)
- Heurística de dispositivo puede marcar `inconsistent`/`not_verifiable` → revisión, no descalificación automática
- Jurado aún no consume `JURY_PREVIEW` en panel de evaluación

---

## 15. Reglas temporales (Santa Fe)

Documentadas en seed `uploadPolicyJson`:

- JPEG only, max 25 MB, min 1200×800, min 1.5 MP
- EXIF/GPS/fecha no obligatorios
- 1 obra por inscripción
- Replace hasta cierre de submission
- `draftConfig: true`

---

## 16. Próximo paso recomendado

**P0-11 / evaluación jurado:** entregar solo `entryNumber` + categoría + signed `JURY_PREVIEW` + resumen técnico permitido; sin identidad ni original.  
En paralelo: cablear Public API `confirmedCount`, UI org “Publicar bases”, adapter R2 prod detrás del mismo storage interface.

---

## APIs

- `POST /api/fotorank/contests/[contestId]/entries/upload-intent`
- `POST .../entries/[entryId]/upload`
- `POST .../entries/[entryId]/replace`
- `POST .../entries/[entryId]/confirm`
- `DELETE .../entries/[entryId]`
- `GET .../entries/me`
- `GET .../entries/[entryId]/checklist`
- `GET .../entries/[entryId]/preview`
- `POST .../entries/[entryId]/review`
- `GET .../registrations/admin`
- `GET /api/fotorank/private-asset`

## UI

- Participante: `EntryUploadPanel` en `/concursos/[slug]/inscripcion` + estado en `/participaciones`
- Org: listado + detalle + revisión manual

## Confirmación operativa

- DB usada: `postgresql://…@localhost:5432/fotorank_p0_06_test`
- Sin commit / push / deploy
- Sin migraciones sobre Neon
