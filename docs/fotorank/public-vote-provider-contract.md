# Public Vote Provider Contract (ETAPA 17A → 17B)

**Estado:** contrato provider-agnostic.  
**17A implementa:** `TEST_PROVIDER` solamente.  
**17B:** auditar Meta/Instagram API real **antes** de implementar. No asumir soporte completo.

## Adapter

```ts
type PublicVoteProviderAdapter = {
  name: "TEST_PROVIDER" | "INSTAGRAM_FUTURE" | string;
  health(): Promise<"CONNECTED" | "DEGRADED" | "STALE" | "ERROR">;
  fetchObservations?(input: {
    roundId: string;
    publicCodes: string[];
    asOf: Date;
  }): Promise<NormalizedMetricObservation[]>;
};
```

## Qué debe poder proveer una integración social futura

| Capacidad | Descripción | Obligatorio para cerrar |
|-----------|-------------|-------------------------|
| Authentication | Credenciales / OAuth de la cuenta del organizador | Sí (si provider ≠ TEST) |
| Account identifier | ID estable de cuenta social | Sí |
| Publication identifier | ID del post/story/reel por candidatura | Sí para mapping |
| Candidate mapping | `publicCode` ↔ publication id | Sí |
| Metric value | Valor numérico (p. ej. like_count) | Sí |
| Provider timestamp | Momento de la métrica en origen si existe | Preferible |
| Observation timestamp | `providerObservedAt` usado en cutoff | Sí |
| Rate-limit info | headers / retry-after | Recomendado |
| Health | CONNECTED / DEGRADED / STALE / ERROR | Sí |
| Errors | códigos normalizados (auth, not_found, unavailable) | Sí |
| Publication capability | ¿El motor publica? (fuera de 17A) | Opcional / 17B+ |
| Metric read capability | Lectura periódica o on-demand | Sí |
| Final snapshot capability | ¿El provider entrega snapshot oficial al cierre? | A auditar en 17B |
| Webhook / polling | Push vs pull | A auditar en 17B |

## Observación normalizada (core)

```ts
type NormalizedMetricObservation = {
  candidatePublicCode: string;
  metricValue: number;
  providerObservedAt: Date;
  providerMetricTimestamp?: Date | null;
  providerEventKey: string; // idempotencia
  rawHash?: string | null;
  metadata?: Record<string, unknown>; // sin PII
};
```

## Cutoff policies (core)

- `LAST_VALID_OBSERVATION_BEFORE_CUTOFF` (default 17A / TestProvider)
- `EXACT_PROVIDER_TIMESTAMP`
- `PROVIDER_FINAL_SNAPSHOT`

**No decidir** cuál usará Instagram hasta auditar Meta en 17B.

## Reglas del core (independientes del provider)

1. `startsAt` / `endsAt` son autoridad server-side.
2. Observaciones append-only; likes pueden bajar.
3. Observaciones tardías se retienen (`isLate`) pero no cuentan bajo la política default.
4. Sin observación válida al corte → `PENDING_FINAL_SNAPSHOT`.
5. Snapshot final inmutable; ranking solo desde snapshot.
6. Empates → tiebreak público recursivo; nunca score de jurado.

## Fuera de alcance 17A

- Llamadas a Meta Graph API
- Stories / publicación automática
- Activación Clickatón comercial
- Publicación de RESULTS
