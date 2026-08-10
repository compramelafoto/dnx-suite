# Public Vote Provider Contract (ETAPA 17A → 17B)

**Estado:** contrato provider-agnostic.  
**17A implementa:** `TEST_PROVIDER`.  
**17B implementa:** `INSTAGRAM` (mock HTTP default; live gated).

## Adapter

```ts
type PublicVoteProviderAdapter = {
  name: "TEST_PROVIDER" | "INSTAGRAM" | string;
  health(): Promise<ProviderHealth>;
  fetchObservations?(input: {
    roundId: string;
    publicCodes: string[];
    asOf: Date;
  }): Promise<NormalizedMetricObservation[]>;
};
```

## Providers operativos

| Provider | Estado 17B | Writes reales |
|----------|------------|---------------|
| `TEST_PROVIDER` | Operativo (regresión E2E) | No |
| `INSTAGRAM` | Operativo (mock + probe gated) | Solo con `FOTORANK_ALLOW_INSTAGRAM_PUBLISH=1` |
| `NONE` | Config only | No |

## Instagram — capacidades (auditoría 2026-08-10)

Ver `instagram-provider-capabilities.md`. Resumen:

- Métrica: `like_count`
- Polling: **requerido** (`canReceiveLikeWebhook: false`)
- Cutoff: `LAST_VALID_OBSERVATION_BEFORE_CUTOFF` only
- Carousel: **no** unidad competitiva
- `providerMetricTimestamp`: null en ingest Instagram

## SocialConnection + Publication

- Ownership: `ContestOrganization` → `FotorankSocialConnection`
- Round referencia `socialConnectionId`
- `FotorankPublicVotePublication`: mapping candidatura ↔ media externo
- Idempotency: `idempotencyKey` unique

## Qué debe poder proveer una integración social

| Capacidad | Instagram 17B |
|-----------|---------------|
| Authentication | OAuth Facebook → IG Graph |
| Account identifier | `accountId` en SocialConnection |
| Publication identifier | `externalMediaId` |
| Candidate mapping | Publication per candidate |
| Metric value | `like_count` via mock/real |
| Provider timestamp | **null** |
| Observation timestamp | poll time → `providerObservedAt` |
| Rate-limit info | `MetaRateLimitState` |
| Health | CONNECTED / DEGRADED / ERROR / EXPIRED |
| Errors | RATE_LIMITED, TOKEN_EXPIRED, PUBLICATION_DELETED, LIKE_COUNT_HIDDEN |
| Publication capability | PREPARED → APPROVED → PUBLISHED |
| Metric read | Polling job |
| Final snapshot capability | Motor 17A (no provider snapshot) |
| Webhook / polling | **Polling only** |

## Observación normalizada (core)

```ts
type NormalizedMetricObservation = {
  candidatePublicCode: string;
  metricValue: number;
  providerObservedAt: Date;
  providerMetricTimestamp?: Date | null; // null para INSTAGRAM
  providerEventKey: string;
  rawHash?: string | null;
  metadata?: Record<string, unknown>;
};
```

## Cutoff policies (core)

- `LAST_VALID_OBSERVATION_BEFORE_CUTOFF` — **default Instagram**
- `EXACT_PROVIDER_TIMESTAMP` — bloqueado para INSTAGRAM
- `PROVIDER_FINAL_SNAPSHOT` — no soportado Meta

## Reglas del core (independientes del provider)

1. `startsAt` / `endsAt` son autoridad server-side.
2. Observaciones append-only; likes pueden bajar.
3. Observaciones tardías se retienen (`isLate`) pero no cuentan bajo la política default.
4. Sin observación válida al corte → `PENDING_FINAL_SNAPSHOT`.
5. Snapshot final inmutable; ranking solo desde snapshot.
6. Empates → tiebreak público recursivo; nunca score de jurado.

## Fuera de alcance 17B comercial

- Activación Clickatón comercial (`cmslf0ny10005i7nlqe7xqbea`)
- Publicación RESULTS
- Scraping / Playwright / Puppeteer contra Instagram
