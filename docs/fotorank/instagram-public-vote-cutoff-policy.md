# Instagram — Política de cutoff para voto público

**Provider:** INSTAGRAM  
**Política:** `LAST_VALID_OBSERVATION_BEFORE_CUTOFF`  
**Precisión Meta:** NOT_GUARANTEED (auditoría 2026-08-10)

## Regla

Al llegar `endsAt`:

1. Round → `CLOSING`
2. Polling FINALIZATION (intervalo conservador)
3. Última observación con `providerObservedAt ≤ endsAt` y `isLate=false` congela métrica
4. Observaciones posteriores: retenidas (`isLate=true`), **no** modifican snapshot

## Campos de autoridad

| Campo | Instagram | Autoridad cutoff |
|-------|-----------|------------------|
| `providerObservedAt` | Momento del poll FotoRank | **Sí** |
| `providerMetricTimestamp` | null (Meta no expone) | No |
| `ingestedAt` | Server ingest | Auditoría only |

## EXACT_PROVIDER_TIMESTAMP

**Bloqueado** para provider INSTAGRAM en config jurado.

## Comunicación organizador

No prometer "likes exactos al segundo del cierre".  
Copy sugerido: "Se utiliza la última lectura válida antes del cierre programado."

## PENDING_FINAL_SNAPSHOT

Si no hay observación válida antes del cutoff → estado pendiente; organizador ve "Esperando verificación de Instagram".

## Near-close

Modo `NEAR_CLOSE` aumenta frecuencia de polling dentro de límites Meta (últimos 5 min).
