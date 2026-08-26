# Santa Fe en Foco — Resultados y publicación controlada (ETAPA 08)

**BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR**

## Resumen

El ranking privado de una sesión CLOSED **no** equivale a resultados oficiales. La publicación exige gates simultáneos evaluados por `evaluateResultPublicationReadiness`.

## Fuente de verdad

- `FotorankJuryEvaluation` (+ scores de criterio)
- `FotorankJuryScoringSession` (CLOSED/LOCKED)
- `FotorankResultBatch` / `FotorankResultEntry`
- Ruleset versionado (`FotorankResultRuleSet`)
- Meta de publicación en `FotorankResultBatch.metadata` (JSON versionado, sin modelos `SantaFe*`)

**No aceptar:** `FotorankJudgeVote`, scores de frontend, evaluaciones draft/VOID, sesión OPEN.

## Estados (batch / publicación)

| Capa | Valores |
|------|---------|
| Batch Prisma | GENERATED → REVIEWED → FINALIZED → PUBLISHED (también CANCELLED) |
| Meta `publication.status` | PRIVATE, SCHEDULED, LIVE, REVOKED, SUPERSEDED |
| Rúbrica / premios / finalistas | PENDING_ORGANIZER_DECISION, STAGING_TEST_CONFIGURATION, CONFIRMED, … |
| Institucional | PENDING, IN_REVIEW, APPROVED, CHANGES_REQUIRED, REJECTED, REVOKED |
| Legal | NOT_REQUESTED, PENDING, APPROVED, CHANGES_REQUIRED, REJECTED |

`GENERATED` ≠ `LIVE`.

## Readiness

`evaluateResultPublicationReadiness` → READY | BLOCKED + reason codes.

Códigos relevantes: `JURY_SESSION_NOT_CLOSED`, `RESULT_BATCH_MISSING`, `RESULT_BATCH_STALE`, `RESULT_BATCH_NOT_FINALIZED`, `RUBRIC_NOT_CONFIRMED`, `AWARDS_NOT_CONFIRMED`, `FINALISTS_NOT_CONFIGURED`, `WINNERS_NOT_CONFIGURED`, `INCOMPLETE_COVERAGE`, `UNRESOLVED_TIE`, `INSTITUTIONAL_APPROVAL_MISSING`, `LEGAL_APPROVAL_MISSING`, `PUBLICATION_ALREADY_LIVE`, `RESULT_REVOKED`, …

Sin override silencioso.

## Rúbrica

Provisional Santa Fe: 5×20%, escala 1–10, desempate `narrative_impact` → **PENDING_ORGANIZER_DECISION**.

Staging: solo `STAGING_TEST_CONFIGURATION`. Confirmación `CONFIRMED` oficial **bloqueada** en código.

## Premios / finalistas / ganadores

Config genérica en meta (placeholders PENDING_*). Finalistas AUTO_TOP_N o manual auditado. Ganadores derivados del ranking; overrides con razón + auditoría. No inventar montos.

## Empates y comité

Empate completo → `TIED` + `COMMITTEE_DECISION_REQUIRED` (flags). Comité: `recordCommitteeDecision` → `resolveTieManual` (conserva scores). API: `POST .../results/committee`.

## Privacidad y scores públicos

Default: **no publicar scores**. Payload público: allowlist; forbid email, GPS, storageKey, privateComment, aggregateScore, etc. Comentarios del jurado privados.

## Preview / público

- Preview privado: `/dashboard/concursos/[id]/resultados/preview` (noindex)
- Público: `/concursos/[slug]/resultados` — mensaje seguro o payload LIVE
- API: `GET /api/public/v1/contests/[slug]/results` — 404 antes de LIVE

## Publicación

Frase staging: `STAGING_TEST_PUBLICATION`. Frase oficial Santa Fe: **bloqueada** en esta etapa. Exige hash coincidente, readiness READY, batch FINALIZED, idempotency key. Timezone: `America/Argentina/Cordoba`. Scheduling automático: **no fingido** — publicación manual; cron documentado como limitación.

Publicación preferida: **todas las categorías juntas**.

## Inmutabilidad / revoke / versiones

Post-LIVE: no editar en lugar; revoke → FINALIZED + REVOKED; revisiones en `FotorankResultRevision`.

## APIs privadas

- `GET .../results/readiness`
- `POST .../results/publish`
- `POST .../results/committee`
- `GET .../results/history?batchId=`

## UI organizador

`/dashboard/concursos/[id]/resultados` + `PublicationGatesPanel`.

## Notificaciones

Intents: FINALIST_SELECTED, WINNER_SELECTED, RESULTS_APPROVED, RESULTS_SCHEDULED, RESULTS_PUBLISHED, RESULTS_REVOKED — sin envío real si email inactivo.

## Tests / ops

- `pnpm --filter fotorank test:results:publication`
- `ops:sfef-08:fixtures` / `ops:sfef-08:cleanup`
- `test:e2e:sfef-08:staging`

## R2 / Performance

Originales privados; payload sin storage keys. Ranking precomputado en batch; API pública no recalcula.

## Acción legal

Obligatoria antes de resultados reales: bases, rúbrica, desempate, premios/impuestos, créditos, licencia, ARGRA, drones, privacidad, revocación, reclamaciones.

## Riesgos

- Publicar con rúbrica/premios provisionales como oficiales → mitigado (CONFIRMED bloqueado; staging phrase only).
- Filtrar ranking privado → API pública solo LIVE sanitizado.
- Editar LIVE en lugar → revoke + nueva versión.

---

**BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR**
