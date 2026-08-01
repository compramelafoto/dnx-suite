# FotoRank — Etapa 15: ranking, desempates y resultados

**Estado:** implementado (código) · **LIVE publicación:** deshabilitada

Doc producto: [`docs/clickaton/CLICKATON_RANKING_AND_RESULTS.md`](../clickaton/CLICKATON_RANKING_AND_RESULTS.md)

## Dominio

`apps/fotorank/app/lib/fotorank/results/`

| Módulo | Rol |
|---|---|
| `ranking-engine` | Motor puro WEIGHTED_AVERAGE + desempates |
| `result-service` | Ruleset, batch, finalize, exports, identidad |
| `permissions` | Caps org vs sensibles |
| `social-publication-gate` | Bloqueo LIVE Etapa 15 |
| `notification-intents` | Intents sin envío |

## UI

`/dashboard/concursos/[id]/resultados` — sección Etapa 15 + legado JudgeVote.

## Selfcheck

```bash
pnpm --filter fotorank test:results:ranking
```
