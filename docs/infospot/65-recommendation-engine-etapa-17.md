# ETAPA 17 — DNX Recommendation Engine

## Arquitectura

```
App (InfoSpot) — carga candidatos Prisma
        ↓ adaptadores
@repo/recommendations — RecommendationEngine (puro)
        ↓ usa
@repo/geo — distanceKm
```

## Integración InfoSpot

`getArticleRecommendationBlocks` → `RecommendationBlocks` en detalle de noticia.

Bloques: similar, nearby, upcoming, open calls, coverages.

Explicabilidad: `explain.summaryLines` solo en `NODE_ENV=development`.

## Tests

```bash
pnpm --filter @repo/recommendations test
pnpm --filter infospot test
```
