# ETAPA 16B — Finalistas y preparación de voto público

**Canónico:** `docs/clickaton/jury-and-public-voting-master-rules.md` (§1, §5.1, §7, §8, §9, §10)

Esta etapa implementa el **dominio core** (schema + servicios de librería) para:

1. Seleccionar exactamente `finalistsPerUnit` (default 3) **finalistas por consigna** (`promptExternalId`) a partir del ranking cerrado de jurado, sin decidir el ganador definitivo.
2. Armar y confirmar un **paquete de finalistas** inmutable, listo para preparación de voto público.
3. Configurar (sin activar) el **voto público** por concurso.
4. Preparar assets social-safe (derivados) **sin publicar ni subir a Instagram**.

No incluye rutas de API, UI ni integraciones externas (Instagram, notificaciones push de voto público) — eso queda para etapas posteriores.

## Principio rector

> **FINALISTA ≠ ganador definitivo.** El jurado nunca decide la posición pública final; solo produce un pool preseleccionado por consigna. La posición definitiva la decide el público (voto) o el mecanismo de desempate público, nunca el score de jurado.

Por eso:

- `internalJuryRank` es **solo** el orden interno de corte de selección (1..N dentro de la consigna). Nunca se expone como posición pública.
- `FotorankResultEntry.finalPosition` se mantiene `null` para las filas de finalistas; solo se usa `preliminaryPosition` (= `internalJuryRank`).
- `FotorankResultRuleSet` de finalistas tiene `rankingEnabled: false` — es un ruleset de selección, no de ranking público.

## Guardas de seguridad (defensa en profundidad)

| Guarda | Archivo | Qué evita |
|---|---|---|
| Concurso comercial bloqueado | `commercial-contest-guard.ts` | Activar jurado / paquete de finalistas / voto público sobre `cmslf0ny10005i7nlqe7xqbea` en esta etapa. Se invoca en `openJurySession`, `selectFinalistsPerPrompt`, `confirmFinalistsForPublicVote`, `upsertPublicVoteConfig` (cuando habilita). |
| Anti-PII en metadata | `finalist-pii-guard.ts` | Que `FotorankFinalistSnapshot.metadataJson` incluya nombre, email, teléfono, handle de Instagram, DNI, EXIF/GPS, etc. Se invoca antes de cada `create`/`update` de snapshot y en `evaluatePrePublicVoteReadiness`. |
| Provider no habilitado | `public-vote-config.ts`, `pre-public-vote-readiness.ts` | Que se configure `publicVoteProvider = INSTAGRAM_FUTURE` en esta etapa (fuera de alcance, §9.3). Solo `NONE` es aceptado hoy. |

## Esquema (additivo)

### `FotorankCompetitionJuryConfig` (extendido)

Columnas nuevas, todas opcionales o con default — **no rompe** contests existentes (incluye Santa Fe En Foco, que sigue usando 5 criterios y nunca toca estos campos):

`publicVoteEnabled`, `publicVoteUnit`, `publicVoteMetric`, `publicVoteDurationMinutes`, `publicVoteStartsAt`, `publicVoteEndsAt`, `publicVoteProvider`, `publicVoteStatus`, `publicTieBreakMode`, `timezone`.

### `FotorankFinalistSnapshot` (nuevo)

Ítem inmutable del paquete de finalistas. Una fila por finalista seleccionado en una consigna. `@@unique([contestId, promptExternalId, publicCode])` garantiza que el código público (`C01-F01`) sea único por consigna dentro del concurso.

### `FotorankFinalistPackage` (nuevo)

Sobre de confirmación por sesión de jurado. `DRAFT` (editable, se recalcula) → `CONFIRMED` (inmutable, habilita voto público) → `INVALIDATED` (si se revoca un finalista después de confirmar, hasta re-confirmar).

Migración: `packages/db/prisma/migrations/20260810140000_fotorank_jury_16b_finalists_public_prep/`.

## Servicios (`apps/fotorank/app/lib/fotorank/jury/`)

### Readiness (gate antes de cada transición de estado)

- **`pre-jury-readiness.ts`** — `evaluatePreJuryReadiness(contestId)`: valida congelamiento de elegibilidad/admisión, jurado aceptado, cobertura estructural posible (`entries * evaluacionesRequeridas <= jueces * cargaRecomendada`), rúbrica activa con criterios, anonimización completa y que no haya sesión ya `OPEN`. Retorna `READY_FOR_JURY | BLOCKED` + razones estructuradas.
- **`pre-public-vote-readiness.ts`** — `evaluatePrePublicVoteReadiness(contestId)`: valida sesión `CLOSED/LOCKED`, cobertura completa de finalistas por consigna, conteo total de posiciones (30 en Clickatón = 10 consignas × 3), sin empates pendientes, assets `READY`, códigos públicos válidos (`Cnn-Fn`), sin PII, config de voto público válida y ventana de fechas coherente. Retorna `READY_FOR_PUBLIC_VOTE | BLOCKED`.

### Ciclo de vida de jurado

- **`jury-session-lifecycle.ts`** — `openJurySession` (requiere readiness `PASS`), `closeJurySession` (bloquea si cobertura incompleta o hay conflictos/pospuestos pendientes), `forceCloseJurySession` (vía Super Admin, con motivo obligatorio; **no** calcula finalistas si la cobertura quedó incompleta). Todas auditan vía `FotorankJudgeAuditEvent`.

### Motor de finalistas

- **`finalists-engine.ts`** — `selectFinalistsPerPrompt({contestId, scoringSessionId, actorUserId})`: agrupa candidatos con cobertura completa de evaluaciones por `promptExternalId`, ordena por promedio normalizado y luego por el orden de criterios de la rúbrica activa (`sortOrder` asc — para Clickatón: Interpretación → Creatividad → Composición, sin hardcodear claves), corta en `finalistsPerUnit`. Si el corte queda empatado, marca la consigna `tieBreakRequired` y dispara `requestExtraJudgeTiebreak` (reutiliza ETAPA 16A) en lugar de forzar una selección arbitraria. Crea/actualiza `FotorankResultBatch` + `FotorankResultRuleSet` (`rankingEnabled: false`, `winnersPerScope = finalistsPerUnit`) y `FotorankResultEntry` (`resultStatus: FINALIST`, `finalPosition: null`). Crea `FotorankFinalistSnapshot` con `publicCode` determinístico y pasa cada `metadataJson` por el guard anti-PII antes de persistir.

### Paquete de confirmación

- **`finalist-package.ts`**:
  - `buildFinalistPackage` — snapshot `DRAFT` del estado actual + readiness embebido, sin confirmar.
  - `confirmFinalistsForPublicVote` — exige `READY_FOR_PUBLIC_VOTE`, bloquea si ya hay un paquete `CONFIRMED` para la sesión, calcula `confirmHash` (hash determinístico de los finalistas) y marca paquete + snapshots como `CONFIRMED` (inmutables desde ese momento).
  - `revokeFinalist` — revoca un snapshot puntual con motivo auditado, invalida el paquete si estaba `CONFIRMED`, y promueve automáticamente al siguiente candidato elegible de la misma consigna para no dejar huecos en el pool.

### Configuración de voto público (sin activar nada)

- **`public-vote-config.ts`** — `getPublicVoteConfig` / `upsertPublicVoteConfig`: persiste modo (`DISABLED | JURY_ONLY | JURY_THEN_PUBLIC`), unidad, métrica, duración, ventana y provider en `FotorankCompetitionJuryConfig`. Nunca habilita automáticamente en concursos comerciales (guard) ni permite `INSTAGRAM_FUTURE` en esta etapa.

### Preparación de assets (stub-safe)

- **`public-asset-prep.ts`** — `prepareFinalistPublicAssets`: marca `derivativeStatus: READY` con una política placeholder (recorte/aspecto/marca de agua documentada en `metadataJson`), genera solo una **referencia** de asset derivado (`derivativeAssetKey`), nunca la key del original. **No** sube nada a Instagram ni publica. `markFinalistAssetFailed` para el camino de error.

## Flujo end-to-end (solo dominio, sin UI/API todavía)

```
evaluatePreJuryReadiness → openJurySession → (evaluación de jurado, ETAPA 15/16A)
  → closeJurySession → selectFinalistsPerPrompt → buildFinalistPackage
  → evaluatePrePublicVoteReadiness → prepareFinalistPublicAssets
  → confirmFinalistsForPublicVote → (voto público: fuera de alcance de 16B)
```

## Fuera de alcance (explícitamente)

- Rutas de API (`app/api/**`) y UI de organizador/público.
- Integración real con Instagram u otro provider (`publicVoteProvider` queda en `NONE`).
- Cualquier activación sobre el concurso comercial `cmslf0ny10005i7nlqe7xqbea` (bloqueado por código, no solo por proceso).
- Modificación de la rúbrica de 5 criterios de Santa Fe En Foco (el motor de finalistas es genérico y lee `sortOrder` de la rúbrica activa; no se tocó `santa-fe-en-foco-rubric.ts`).
