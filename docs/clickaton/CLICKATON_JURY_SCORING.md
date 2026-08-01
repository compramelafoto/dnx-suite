# Clickatón / FotoRank — Jurados, rúbricas y puntuación anónima (Etapa 14)

**Fecha:** 2026-07-28  
**Alcance:** evaluación ciega sobre roster congelado. **Sin ranking público, ganadores ni resultados LIVE.**

Docs relacionadas:

- `CLICKATON_TECHNICAL_ADMISSION.md` (fuente FROZEN)
- `CLICKATON_TIMELINE_AND_PARTICIPANT_EXPERIENCE.md` (`JUDGING_OPEN` / `JUDGING_CLOSE`)
- `docs/fotorank/fotorank-p0-07-jury-anonymization-storage-report.md`

---

## 1. Arquitectura encontrada (auditoría)

| Pieza | Estado previo | Etapa 14 |
|---|---|---|
| `FotorankJudgeAccount` / Profile | Existe | Reutilizado |
| Invitaciones (`FotorankJudgeInvitation`) | Existe | Reutilizado |
| Assignments (`FotorankJudgeAssignment`) | Existe | + `admissionBatchId`, `promptExternalId` opcionales |
| Conflictos (`FotorankJudgeEntryConflict`) | Existe | Reutilizado (bloquea submit) |
| `JudgeVote` + criteriaScoresJson | Legacy equal-weight | Conservado; no fuente Etapa 14 |
| Panel `/jurado` | Anónimo P0-07 | + rúbrica, autosave, submit, consigna |
| Panel org `/dashboard/concursos/[id]/jurado` | Invitaciones/asignaciones | + sesión scoring / cobertura |
| Batch FROZEN + snapshots | Etapa 13 | **Única fuente de obras** |
| Rúbrica tipada / sesión / agregados | Ausente | **Nuevo** |

**Clickatón:** no duplica lógica de jurado. Expone timeline, consignas, batch/snapshots vía sync/admisión. FotoRank consume exclusivamente `FROZEN`.

---

## 2. Contrato de jurado

Fuente exclusiva:

1. `FotorankAdmissionBatch.status = FROZEN`
2. `FotorankContestEntry.admissionStatus = FROZEN_FOR_JURY`
3. `FotorankJuryEntrySnapshot` (`anonymousCode`, `juryAssetId`, categoría, consigna)
4. Rúbrica `ACTIVE` de sesión `OPEN` con `scoringEnabled=true`

**Visible al jurado:** código anónimo, preview firmado corto, título/texto de consigna habilitada, categoría, criterios, progreso propio, comentarios propios, metadata técnica allowlisted.

**Oculto:** nombre, email, Instagram, teléfono, userId, registrationId, nº público Clickatón, archivo original, GPS exacto, notas admin, scores de terceros, ranking, promedio, likes, orden de inscripción.

El organizador con `canResolveJuryIdentity` puede resolver identidad **fuera** de la vista del jurado.

---

## 3. Modelos reutilizados vs nuevos

### Reutilizados

- `FotorankJudgeAccount`, `FotorankJudgeInvitation`, `FotorankJudgeAssignment`
- `FotorankJudgeEntryConflict`, `FotorankJudgeAuditEvent`
- `FotorankAdmissionBatch`, `FotorankJuryEntrySnapshot`
- Outbox `JURY_INVITATION` (+ nuevos kinds sin scores)

### Nuevos

| Modelo | Rol |
|---|---|
| `FotorankJuryRubric` | Rúbrica versionada (DRAFT/ACTIVE/SUPERSEDED/CANCELLED) |
| `FotorankJuryCriterion` | Criterios con peso, min/max/step |
| `FotorankJuryScoringSession` | DRAFT→OPEN→CLOSED; `scoringEnabled` default **false** |
| `FotorankJuryEvaluation` | Autosave/submit; optimistic lock `expectedVersion`; idempotency |
| `FotorankJuryCriterionScore` | Scores por criterio (snapshots de nombre/peso) |
| `FotorankJuryPreliminaryAggregate` | Agregados privados al cierre (sin ranking) |

Migración: `packages/db/prisma/migrations/20260728140000_clickaton_jury_scoring/`

---

## 4. Anonimización

- DTO allowlist en `serialize-entry-for-juror.ts` + `assertNoForbiddenJuryFields`
- Preview solo `JURY_PREVIEW` firmado; ORIGINAL inaccesible al jurado
- Agregados y exports ciegos usan `anonymousCode`, nunca identidad

---

## 5. Invitaciones y asignaciones

- Invitación opaca, expiración, un solo uso, vinculada a concurso (+ batch cuando aplique)
- Modos: ALL_ENTRIES / CATEGORY / PROMPT / CATEGORY_AND_PROMPT / CUSTOM_SET (vía assignment + filtros)
- Distribución reproducible con `assignmentSeed` en sesión
- Cobertura: mínimo de evaluaciones por obra; reporte de incompletas/conflictos

---

## 6. Conflictos

Declaración en `FotorankJudgeEntryConflict`. Si `ACTIVE` → bloquea submit definitivo. Reasignación + auditoría; no revela identidad adicional.

---

## 7. Rúbricas y scoring

- Modo MVP: `WEIGHTED_SCORE` (motor puro `scoring-engine.ts`, `engineVersion` versionado)
- Totales **solo backend**; frontend no es fuente de verdad
- ACTIVE inmutable si hay SUBMITTED; nueva versión para cambios
- Cada evaluación guarda `rubricId`, `rubricVersion`, `criteriaSnapshot`, `engineVersion`

---

## 8. Autosave y submit

| Estado | Comportamiento |
|---|---|
| `IN_PROGRESS` | Editable; no cuenta en agregados |
| `SUBMITTED` / `LOCKED` | Bloqueada; entra en preliminares |
| `VOIDED` | Excluida de agregados; no borrada |

Optimistic locking: `expectedVersion`. Idempotency key en submit. Autosave viejo → `VERSION_CONFLICT`.

---

## 9. Timeline

Consume `JUDGING_OPEN` / `JUDGING_CLOSE` (Clickatón). Servidor valida ventana (`opensAt`/`closesAt` en sesión). Sin duplicar fechas de negocio si se pueden referenciar desde timeline.

---

## 10. Paneles

- **Jurado:** `/jurado/concursos/[contestId]` — obras, consigna, rúbrica, autosave/submit, conflicto
- **Org:** `/dashboard/concursos/[id]/jurado` — sesión DRAFT/OPEN/CLOSE, cobertura, invitaciones, conflictos

Sin ranking ni promedios de terceros en vista jurado.

---

## 11. Cierre y agregados privados

Cierre bloqueado si cobertura incompleta o conflictos abiertos, salvo `force` auditado.  
Al cerrar: promedio, mediana, dispersión, normalizado, flags de cobertura → `FotorankJuryPreliminaryAggregate`.  
**No** publica ranking, ganadores ni notifica scores a participantes.

---

## 12. Exportaciones

| Export | Contenido |
|---|---|
| Progreso | jurado, estado, pendientes/enviadas |
| Admin evaluaciones | código anónimo + scores + jurado (sin identidad participante) |
| Ciego | código anónimo + agregados |

---

## 13. Notificaciones

Intents durables (`enqueueJuryNotificationIntent`): invitación, recordatorio, apertura, pendiente, cierre próximo, asignación, conflicto reasignado, sesión cerrada.  
`live: false`. Sin scores ni ranking en payload.

---

## 14. Permisos

Ver `permissions.ts`: `canManageContestJurors`, `canInvite…`, `canAssign…`, `canManageJuryRubrics`, `canViewJuryProgress`, `canCloseJuryScoring`, + sensibles (`canViewIndividualJurorScores`, `canExportJuryScores`, `canVoid…`, `canReopen…`, `canResolveJuryIdentity`).  
Organizadores: set operativo por defecto **sin** scores individuales.

---

## 15. Seed

- `scoringEnabled=false`; sin apertura LIVE
- Sin scores `FotorankJuryEvaluation` en seed
- Rúbrica ejemplo solo local on-demand
- Clickatón seed: `juryScoring.scoringEnabled=false`

---

## 16. Tests

```bash
pnpm --filter fotorank test:jury:scoring
pnpm --filter fotorank test:jury:selfcheck
pnpm --filter fotorank check-types
pnpm --filter clickaton selfcheck:technical-admission
pnpm --filter clickaton selfcheck:accreditation
pnpm --filter clickaton selfcheck:photo-upload
pnpm --filter clickaton selfcheck:timeline
pnpm --filter clickaton selfcheck:fotorank-sync
```

---

## 17. Etapa 15 / 16

- **Etapa 15 (hecha):** ranking privado / desempates / batch — `CLICKATON_RANKING_AND_RESULTS.md`
- **Etapa 16+:** publicación pública, notificar ganadores, Social LIVE, certificados, premiación
