# Clickatón / FotoRank — Ranking, desempates y resultados (Etapa 15)

**Fecha:** 2026-07-28  
**Alcance:** ranking privado + batch de resultados. **Sin publicación LIVE, sin notificar ganadores, sin Social Publisher LIVE.**

Docs: `CLICKATON_JURY_SCORING.md` · `CLICKATON_TECHNICAL_ADMISSION.md` · `CLICKATON_TIMELINE_AND_PARTICIPANT_EXPERIENCE.md`

---

## 1. Arquitectura encontrada

| Pieza | Estado |
|---|---|
| Sesión CLOSED + PreliminaryAggregate | Etapa 14 — fuente |
| Ranking admin `JudgeVote` | Legado — no fuente Etapa 15 |
| `PublicMarathonResults` | Tipado Clickatón — payload vacío |
| `RESULTS_RELEASE` timeline | Hito — no publica automáticamente |
| Social Publisher RESULTS caption | Helper — no enqueue ganadores |

**Gaps cerrados:** ResultRuleSet, ResultBatch, ResultEntry, TieBreakSession, ResultExclusion, ResultRevision, motor `ranking-engine`.

---

## 2. Fuente de verdad

- scoring session `CLOSED` | `LOCKED`
- evaluaciones `SUBMITTED` | `LOCKED` (no DRAFT, no VOIDED)
- entries `FROZEN_FOR_JURY` (no withdrawn/replaced/rejected)
- snapshots + ruleset versionado + `engineVersion`

---

## 3. Ruleset y agregación

MVP: `WEIGHTED_AVERAGE` sobre totales/normalizados.  
Descartes mayor/menor **off** por defecto.  
Cobertura: `minimumValidEvaluations`; incompletas → `REVIEW_REQUIRED` / bloqueo de finalize.

---

## 4. Desempates

Orden MVP: criterio prioritario → mediana → menor dispersión → `MANUAL_TIEBREAK_REQUIRED`.  
No usa inscripción, ID, nombre ni popularidad.  
`FotorankTieBreakSession` DRAFT (no auto-open).

---

## 5. Batch y estados

`DRAFT` → `GENERATED` / `REVIEW_REQUIRED` → `READY_TO_FINALIZE` → `FINALIZED` (inmutable).  
`PUBLISHED` preparado pero **no** automático.  
Regeneración cancela batches no finalizados.

---

## 6. Identidad

Vista anónima por defecto.  
`canResolveResultIdentity` para export admin / resolución.  
Jurado no ve identidad ni ranking preliminar.

---

## 7. Publicación / Social / Media

- Gate `assertCanEnqueueResultsSocialPublish` → siempre bloquea en Etapa 15 (`ETAPA_15_NO_LIVE_PUBLISH`)
- Plantillas draft en `@repo/media-composition` (`clickaton.results.*.draft`)
- Timeline: no publicar antes de `RESULTS_RELEASE` (Etapa 16)

---

## 8. Seed

`rankingEnabled=false`; ruleset solo on-demand DRAFT; sin ganadores ni publicación.

---

## 9. Tests

```bash
pnpm --filter fotorank test:results:ranking
pnpm --filter fotorank test:jury:scoring
pnpm --filter clickaton selfcheck:timeline
pnpm --filter clickaton selfcheck:social-publisher
```

---

## 10. Bloqueos Etapa 16

Publicación pública, notificaciones a ganadores, placas finales, certificados, People’s Choice, Social LIVE.
