# Santa Fe en Foco — Operaciones de jurado (ETAPA 07)

**BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR**

Palabra clave: **SANTA FE** · App: FotoRank · Concurso slug: `santa-fe-en-foco`

## Arquitectura

Reutiliza el motor nativo FotoRank (Etapas 14/15). **No** existen tablas `SantaFeJury*`.

| Pieza | Fuente |
|---|---|
| Snapshot anónimo | `FotorankJuryEntrySnapshot` (post-freeze admisión) |
| Evaluación canónica | `FotorankJuryEvaluation` + scores por criterio |
| Sesión / ronda | `FotorankJuryScoringSession` |
| Rúbrica versionada | `FotorankJuryRubric` + `FotorankJuryRubricCriterion` |
| Asignación | `FotorankJudgeAssignment` (+ `admissionBatchId`) |
| Invitación | `FotorankJudgeInvitation` |
| Conflicto | `FotorankJudgeEntryConflict` |
| Ranking privado | `FotorankResultBatch` / `FotorankResultEntry` (Etapa 15) |
| Legado | `FotorankJudgeVote` — **no canónico** para Santa Fe |

## Fuente de verdad

- **Canónica:** `FotorankJuryEvaluation` sobre snapshot `FROZEN_FOR_JURY`.
- **`FotorankJudgeVote`:** legado / referencia UI; no debe alimentar ranking Santa Fe.
- Dualidad documentada en UI organizador (`/jurado` + `/resultados`).

## Roles

| Rol | Puede | No puede |
|---|---|---|
| Organizador / admin org | invitar, asignar, abrir/cerrar sesión, ranking privado, recalcular | editar submit de jurado sin override auditado |
| Jurado | evaluar asignadas, draft, conflicto, abstener, submit | ver PII, ranking antes de cierre, obras no asignadas |
| Participante | — | acceder al panel jurado |

## Invitaciones

Flujo nativo `FotorankJudgeInvitation` (token, expiración, estados). Si el proveedor de email no está activo: `notificationIntent` + link recuperable solo en panel seguro. Tokens no se loguean ni se listan completos.

## Términos del jurado

Versión staging: `sfef-jury-terms-draft-v1` (`SANTA_FE_JURY_TERMS_VERSION`).

Persistencia: `methodConfigJson.juryTermsAcceptance` en asignaciones + audit `JURY_TERMS_ACCEPTED`.

UI: `JuryTermsGate` en `/jurado/concursos/[contestId]`. Submit Santa Fe exige aceptación (`TERMS_REQUIRED`).

Estado legal: **borrador de prueba** — no aceptación definitiva.

## Categorías

Sin cambios de catálogo:

- `fotografo-profesional`
- `fotografo-amateur`
- `fotografia-aerea`
- `reportero-grafico`

Asignación por categoría vía `FotorankJudgeAssignment`.

## Asignaciones y distribución

- Congelación previa (ETAPA 06): batch FROZEN + snapshots.
- Asignación amarra `admissionBatchId`.
- Estrategia staging Santa Fe: **todos los jurados asignados a la categoría evalúan todas las obras del batch** (volumen pequeño).
- Mínimo configurable: `SANTA_FE_MIN_EVALUATIONS_PER_ENTRY = 3` (no decisión institucional definitiva).

## Conflictos

`FotorankJudgeEntryConflict` ACTIVE bloquea submit. Motivo auditado; no revela autor.

Reasignación (ETAPA 07B): `acceptConflictAndReassign` + API
`POST /api/fotorank/contests/[contestId]/jury/conflicts/[conflictId]/reassign`
+ UI `ConflictReassignPanel`. Marca conflicto `REVIEWED`, voida drafts del jurado en conflicto,
asegura assignment BACKUP al destino, audita `JURY_CONFLICT_REASSIGNED`.

## Abstenciones

`abstainJuryEvaluation` → evaluación `VOIDED` con prefijo `ABSTAIN:` + razón. No cuenta para score. Audita. Puede requerir reasignación para cobertura.

## Anonimización

Payload de jurado construido en backend (`buildAnonymousJuryPayload` + assert en freeze). Frontend no es la frontera de seguridad. Sin nombre, email, ARGRA, GPS, filename, keys, etc.

## Imagen para jurado

Derivado / proxy autorizado; sin original privado; sin URL permanente garantizada. Screenshots no se pueden impedir al 100%.

## Rúbrica

Plantilla staging (`santa-fe-en-foco-rubric.ts`):

1. Composición  
2. Técnica  
3. Originalidad  
4. Narrativa o impacto (`narrative_impact`)  
5. Relación con la temática  

Pesos 20% · escala 1–10 · estado `PENDING_ORGANIZER_DECISION`.

## Scoring

Promedio ponderado determinista en backend (`computeWeightedScore`). Solo evaluaciones `SUBMITTED`/`LOCKED`. VOID/abstain/conflicto no puntúan.

## Normalización

Sin normalización estadística entre jurados en v1. Métricas internas (avg/min/max/count) en agregados preliminares; no públicas.

## Empates

Ruleset Santa Fe: `priorityCriterionKey = narrative_impact` (luego motor Etapa 15: score → prioridad → mediana/dispersión según strategy). Sin desempate por fecha de carga. Comité final auditado si aplica.

## Draft / Submit / Lock

Estados de evaluación nativos (`IN_PROGRESS` → `SUBMITTED` → `LOCKED`). Submit idempotente por `idempotencyKey`. Tras submit/lock no edición ordinaria.

## Comentarios

`privateComment` vs `participantFeedback`. Default privado; no auto-publicable. Advertencia anti-PII en UI.

## Progreso / deadlines

Cobertura vía `getCoverageReport`. Timezone concurso: `America/Argentina/Cordoba`. Deadlines de sesión: `opensAt` / `closesAt` (placeholders staging si no configurados).

## Ronda / cierre / recálculo

- Apertura explícita: `openScoringSession` (no automática por freeze).
- Cierre bloquea si `incompleteEntries > 0` salvo `force` auditado.
- Ranking privado: `generateResultBatch` solo con sesión `CLOSED`/`LOCKED`. No LIVE / no publicación (ETAPA 08).

## Shortlist

Preparable vía awards preliminares del ruleset; sin publicación en esta etapa.

## Revocación

Revocar asignación / anular evaluaciones (`VOIDED`) con motivo; no borrar; reasignar cobertura.

## Permisos

Server-side en APIs `/api/fotorank/jury/**` y acciones de scoring/results. Cross-contest / cross-org rechazados.

## Auditoría

Eventos en `FotorankJudgeAuditEvent` (invitación, términos, sesión open/close, evaluación, ranking, etc.). Sin tokens, URLs firmadas ni PII.

## API (resumen)

Organizador: scoring-actions / result-actions + panel `/dashboard/concursos/[id]/jurado`.

Jurado: assignments, snapshot, draft/submit, conflict, abstain, terms.

## UI

- Organizador: `/dashboard/concursos/[id]/jurado` + `ScoringSessionPanel`.
- Jurado: `/jurado/...` + términos + evaluación + abstener.

## Tests

- Unit/selfcheck: `santa-fe-jury.selfcheck.ts`, `santa-fe-ranking-source.selfcheck.ts` (falla si ranking usa `FotorankJudgeVote`), cobertura 0–4/3 + VOID/conflicto/revocado.
- E2E staging 8/8: `e2e/santa-fe-07-jury-staging-matrix.spec.ts` + creds `/tmp/sfef-07b-creds.env`.
- Ops 07B: `scripts/ops-sfef-07b-jury-e2e-fixtures.ts`, cleanup `ops-sfef-07b-cleanup-fixtures.ts`.
- Cierre API: `POST .../jury/scoring-sessions/[sessionId]/close` (sin force por defecto).

## Performance

Diseñado para miles de evaluaciones vía agregación/groupBy; cierre por sesión/batch. Selfcheck en memoria para fórmula/cobertura. Sin load test destructivo.

## Emails

Si Resend inactivo: intents `JURY_*` / `JURY_SCORING_*` / results — no bloquean flujo.

## R2

Derivados de jurado en bucket staging; originales privados. Smoke R2 requerido en validación staging.

## Acción legal

Revisión obligatoria: términos, confidencialidad, conflictos, scoring, desempate, conservación, comentarios, publicación futura. Staging con fixtures `@fotorank.test` únicamente.

## Riesgos

1. Dualidad Vote vs JuryEvaluation si un consumidor mezcla motores.  
2. Sesión OPEN única por concurso (`loadOpenSession`) — aislar batches.  
3. Términos aún en `methodConfigJson` (persistencia genérica).  
4. Rúbrica / mínimos no aprobados institucionalmente (`PENDING_ORGANIZER_DECISION` / `STAGING_TEST_CONFIGURATION`).

## ETAPA 07B — cierre E2E (staging)

| Ítem | Estado |
|---|---|
| Playwright 8/8 | PASS |
| Fuente canónica `FotorankJuryEvaluation` | PASS (selfcheck anti-JudgeVote) |
| `@ts-nocheck` scoring/results tocados | RETIRADO de `evaluation-service`, `scoring-session-service`, `jury-service`, `result-service` |
| Rúbrica oficial | NO — sigue borrador staging |
| Production | intacta (`dpl_525VUHaEaz9ANgbFBQnMe9oryZyg`) |
| Preview staging alias | `dpl_CnpeJFY18mcFJhmcJJpSWBsa5MSh` → `fotorank.staging.dnxsuite.com` |
| R2 smoke | FINAL: PASS (`fotorank-private-staging`) |
| Fixtures residuales | 0 tras cleanup |

Matriz E2E: (1) invitación/token/términos (2) draft+submit (3) conflicto+reasignación (4) abstención (5) permisos/anonimización (6) cierre bloqueado (7) cierre+ranking privado (8) empate/narrativa + no LIVE.
