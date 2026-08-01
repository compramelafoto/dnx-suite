# FotoRank — Etapa 14: jurados, rúbricas y puntuación anónima

**Estado:** implementado (código) · **LIVE:** deshabilitado (`scoringEnabled=false` por defecto)

Fuente de verdad de producto Clickatón: [`docs/clickaton/CLICKATON_JURY_SCORING.md`](../clickaton/CLICKATON_JURY_SCORING.md).

## Dominio

`apps/fotorank/app/lib/fotorank/jury/`

| Módulo | Rol |
|---|---|
| `jury-access` / `jury-service` | Roster solo FROZEN + snapshots |
| `scoring-engine` | Motor puro WEIGHTED_SCORE |
| `evaluation-service` | Autosave / submit / void |
| `scoring-session-service` | Rúbrica, sesión, cobertura, exports, agregados |
| `permissions` | Caps organizador vs sensibles |
| `notification-intents` | Intents sin scores |

## UI

- Jurado: `/jurado/concursos/[contestId]`
- Org: `/dashboard/concursos/[id]/jurado`

## Selfchecks

```bash
pnpm --filter fotorank test:jury:scoring
pnpm --filter fotorank test:jury:selfcheck
```

## Etapa 15

Implementada: `docs/clickaton/CLICKATON_RANKING_AND_RESULTS.md` + `apps/fotorank/app/lib/fotorank/results/`.  
Ranking privado sobre sesión `CLOSED`; sin publicación LIVE.
