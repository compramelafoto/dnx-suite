# ETAPA 17A — Arquitectura del motor genérico de votación pública

**Estado:** DONE dominio (provider-agnostic) + E2E **53/53 PASS**  
**Canónico:** `docs/clickaton/jury-and-public-voting-master-rules.md` (§1, §9, §10)  
**Base:** ETAPA 16B (`ETAPA16B_FINALISTS_PUBLIC_PREP.md`)  
**Migración:** `20260810180000_fotorank_public_vote_17a_engine` (aditiva, applied dawn-dew)  
**Backup pre-migrate:** `/tmp/fotorank-prod-backups/fotorank-schema-17a-pre-migrate-20260810T121213Z.sql` SHA256 `2b1afc8e…60488102`

> **EL JURADO SELECCIONA. EL PÚBLICO DECIDE.**  
> 17A NO integra Instagram/Meta. Solo `TEST_PROVIDER`. Clickatón comercial permanece OFF.

## Auditoría post-16B

| Área | Clasificación | Notas |
|------|---------------|-------|
| `FotorankCompetitionJuryConfig` publicVote* | **REUSE / EXTEND** | mode, unit, metric, duration, window, provider, status, tieBreak, timezone |
| `FotorankFinalistSnapshot` + package + codes | **REUSE** | candidatos = finalistas CONFIRMED |
| `evaluatePrePublicVoteReadiness` | **REUSE** | gate previo a crear rounds |
| `commercial-contest-guard` | **REUSE** | bloquea `cmslf0ny10005i7nlqe7xqbea` |
| `assertNoPiiInFinalistMetadata` | **REUSE** | payloads públicos |
| Audit `FotorankJudgeAuditEvent` | **REUSE** | eventos PUBLIC_VOTE_* |
| Notification intents | **EXTEND** | kinds públicos nuevos (`live:false`) |
| Rounds / observations / final snapshots | **NEW** | tablas aditivas 17A |
| Instagram / Meta / Stories | **NOT NEEDED** | ETAPA 17B |
| RESULTS publication comercial | **NOT NEEDED** | solo `CALCULATED` |

## Modelo mental

```text
Finalists CONFIRMED (16B)
  → create PublicVotePhase / Rounds (1 por unidad = PROMPT en Clickatón)
  → SCHEDULED → OPEN (startsAt server)
  → append-only Observations (TestProvider)
  → CLOSING @ endsAt
  → FINAL SNAPSHOT (cutoff policy) | PENDING_VERIFICATION
  → ranking por unit (sin jury score)
  → TIEBREAK rounds si hace falta
  → FINALIZED (resultsPublicationStatus = CALCULATED, never PUBLISHED aquí)
```

## Cutoff policies (provider-agnostic)

| Policy | Uso 17A |
|--------|---------|
| `LAST_VALID_OBSERVATION_BEFORE_CUTOFF` | **default TestProvider** |
| `EXACT_PROVIDER_TIMESTAMP` | preparado; usa `providerMetricTimestamp` |
| `PROVIDER_FINAL_SNAPSHOT` | preparado; 17B auditará Meta |

Observación con `providerObservedAt > endsAt` se **retiene** (`isLate=true`) pero **no** entra al snapshot final bajo la política default.

## Provider contract

Ver `docs/fotorank/public-vote-provider-contract.md`.

## Guards

- Contest comercial bloqueado para enable/open/finalize real.
- `publicVoteProvider=INSTAGRAM_*` no puede `publicVoteEnabled=true` en 17A.
- `TEST_PROVIDER` solo en fixtures / contests no comerciales.
