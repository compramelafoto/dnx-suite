# ETAPA 16A — Auditoría de arquitectura: reuso vs. aditivo

**Rama:** `feat/clickaton-etapa16a-jury-engine`
**Fecha:** 2026-08-10
**Regla canónica:** `docs/clickaton/jury-and-public-voting-master-rules.md`

> Objetivo de esta nota: dejar constancia explícita de que ETAPA 16A **reutiliza** el motor de
> jurado genérico de FotoRank (Etapas 14/15) y **no** crea un sistema paralelo `ClickatonJury*`.
> Todo lo nuevo es aditivo (schema y código) y queda desactivado por defecto.

---

## 1. Principio de diseño

Clickatón es **un cliente más** del motor de jurado de FotoRank (`FotorankJury*`,
`FotorankJudgeAccount`, `FotorankJudgeAssignment`, `FotorankContestEntryJurySnapshot`, etc.),
igual que Santa Fe en Foco. ETAPA 16A añade:

1. **Configuración por concurso** (`FotorankCompetitionJuryConfig`) para que cada concurso
   (Clickatón, Santa Fe, o futuros) pueda tener sus propios umbrales sin tocar código.
2. **Congelamiento de elegibilidad competitiva** de participantes (no de obras individuales —
   eso ya existe en admisión), previo al reparto de jurado.
3. **Calculadora de capacidad** (pura, sin DB) para que el organizador planifique cuántos
   jurados necesita.
4. **Distribución automática** de evaluaciones balanceada entre jurados `ACCEPTED`.
5. **Actividad/ETA** del jurado (tiempo activo real, nunca inventado).
6. **Confirmación de bloque** de evaluaciones (lock) y **ranking provisorio** de solo lectura
   para el organizador, con banner obligatorio de resultado incompleto.
7. **Desempate con jurado adicional** cuando hace falta un voto extra.

Nada de esto activa `scoringEnabled` en ningún concurso ni modifica el rubric de Santa Fe en
Foco. El concurso comercial `cmslf0ny10005i7nlqe7xqbea` **no fue tocado**.

---

## 2. Tablas: reuso vs. nuevas

| Tabla | Tipo | Motivo |
|---|---|---|
| `FotorankJuryEvaluation` | **Reuso + columnas aditivas** | `postponedAt`, `confirmedBlockAt`, `activeSecondsAccumulated`. Es la misma tabla de evaluación por criterio; no hay tabla paralela para Clickatón. |
| `FotorankJuryScoringSession` | **Reuso + columnas aditivas** | `recommendedMaxEntriesPerJudge`, `scoreIntegerOnly`, `scoreScaleMin`, `scoreScaleMax`. Sirve para cualquier concurso, con defaults iguales a los que ya tenía el motor. |
| `FotorankCompetitionJuryConfig` | **Nueva (1:1 con `FotorankContest`)** | Reemplaza lo que hubiera sido "hardcodear" constantes de Clickatón en el código; genérica para cualquier concurso. |
| `FotorankCompetitiveEligibilityFreeze` | **Nueva** | Snapshot versionado e idempotente del corte de elegibilidad competitiva (§3 master rules). No duplica `FotorankContestEntry`/admisión; solo registra el resultado del cálculo y referencia al `admissionBatch`. |
| `FotorankJuryActivityHeartbeat` | **Nueva** | Métrica de tiempo activo real por jurado/concurso, para ETA. No es evaluación de desempeño. |
| `ClickatonJury*` (cualquiera) | **No creada** | Explícitamente prohibido por el encargo; todo vive en `Fotorank*`. |

La única tabla específica de Clickatón que ya existía (`ClickatonRegistration`) se actualiza
puntualmente (`competitiveStatus`, `competitiveValidPromptCount`) desde
`competitive-eligibility-service.ts` **solo si** hay `externalRegistrationId` vinculado, sin
crear relaciones nuevas de jurado sobre esa tabla.

---

## 3. Código: módulos nuevos vs. modificados

### Nuevos (`apps/fotorank/app/lib/fotorank/jury/`)

| Archivo | Responsabilidad |
|---|---|
| `competition-jury-config.ts` | Get-or-create + upsert de config por concurso; defaults Clickatón vs. genéricos. |
| `capacity-calculator.ts` | Cálculo puro de capacidad/semáforo (sin Prisma). |
| `competitive-eligibility-service.ts` | Congelamiento idempotente de elegibilidad + listado de elegibles. |
| `auto-distribution.ts` | Reparto balanceado de evaluaciones tras congelar elegibilidad. |
| `activity-eta.ts` | Heartbeat de actividad + cálculo de ETA con umbral mínimo de muestras. |
| `block-confirm.ts` | Confirmación (lock) de bloque de evaluaciones del jurado. |
| `provisional-ranking.ts` | Ranking provisorio de solo lectura para organizador, con banner obligatorio. |
| `tiebreak-extra-judge.ts` | Asignación de jurado adicional para desempate. |

### Modificados (aditivo, sin romper comportamiento existente)

| Archivo | Cambio |
|---|---|
| `clickaton-2026-rubric.ts` | Rubric reducido a 3 criterios exactos (interpretación, creatividad, composición), pesos iguales, escala 1–10. Se agregan constantes `CLICKATON_MIN_EVALUATIONS_PER_ENTRY`, `CLICKATON_MIN_VALID_ENTRIES`, `CLICKATON_RECOMMENDED_MAX_ENTRIES_PER_JUDGE`. |
| `scoring-session-service.ts` | `ensureDraftRubric` aplica el rubric Clickatón cuando el concurso es Clickatón/maratón-clickaton; el path de Santa Fe en Foco queda intacto. `ensureDraftScoringSession` toma `minimumEvaluationsPerEntry`, `recommendedMaxEntriesPerJudge`, `scoreIntegerOnly`, `scoreScaleMin/Max` desde `FotorankCompetitionJuryConfig` en vez de constantes fijas. |
| `evaluation-service.ts` | Validación de escala/enteros (`scoreIntegerOnly`, `scoreScaleMin/Max`) desde la config del concurso; soporte de `resumePostponedEvaluation` como complemento de `postponeJuryEvaluation` (ya existente). |
| `index.ts` | Exporta todos los módulos nuevos y tipos asociados. |

### Schema y migración

| Archivo | Cambio |
|---|---|
| `packages/db/prisma/schema.prisma` | Enum `POSTPONED`, columnas aditivas en `FotorankJuryEvaluation` y `FotorankJuryScoringSession`, 3 modelos nuevos + relaciones en `FotorankContest`/`FotorankAdmissionBatch`/`FotorankJudgeAccount`. |
| `packages/db/prisma/migrations/20260810120000_fotorank_jury_16a_eligibility_capacity/migration.sql` | 100% aditivo: `ALTER TYPE ... ADD VALUE`, `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`. No hay `DROP`/`ALTER COLUMN` destructivos. |

---

## 4. Qué NO se hizo (por diseño)

- No se activó `scoringEnabled=true` en ningún concurso, en particular no en
  `cmslf0ny10005i7nlqe7xqbea`.
- No se modificaron los defaults del rubric de Santa Fe en Foco
  (`santa-fe-en-foco-rubric.ts` no fue tocado).
- No se crearon tablas `ClickatonJury*` ni se duplicó lógica de evaluación por fuera del motor
  genérico `Fotorank*`.
- No se tocó la lógica de admisión de obras individuales (`FotorankContestEntry` status) — la
  elegibilidad competitiva es un concepto distinto, a nivel de **participante**, que solo lee
  ese estado para calcular el corte.

---

## 5. Compatibilidad con trabajo concurrente (UI/API)

Durante la implementación, rutas API y componentes UI para jurado (`/jurado/concursos/[id]`,
`/api/fotorank/jury/**`, `/api/fotorank/contests/[id]/jury/**`) se desarrollaron en paralelo
sobre el mismo worktree. Las firmas de `computeJuryCapacity`, `getOrCreateCompetitionJuryConfig`,
`recordJuryActivityHeartbeat`, `computeJudgeEta` y `getOrganizerProvisionalRanking` se verificaron
contra esos consumidores reales (import + uso) y `tsc --noEmit` corre sin errores sobre todo
`apps/fotorank`.
