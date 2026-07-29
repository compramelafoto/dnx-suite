# @repo/recommendations — DNX Recommendation Engine

Motor compartido de recomendaciones por **reglas y scores** (sin LLM).

## Dependencias

- `@repo/geo` — distancia Haversine / decay geo
- Sin Prisma / React / Next en el core

## Uso

```ts
import { createRecommendationEngine } from "@repo/recommendations";

const engine = createRecommendationEngine();
const ranked = engine.recommend(candidates, {
  seed,
  block: "similar",
  limit: 6,
});
```

## Bloques

| `block` | Uso |
|---------|-----|
| `similar` | También te puede interesar |
| `nearby` | Cerca de este lugar |
| `upcoming_events` | Próximas actividades |
| `open_calls` | Convocatorias abiertas |
| `coverages` | Coberturas / galerías |

## Config

`src/config.ts` — weights, thresholds, limits, boosts, penalties.

## Personalización futura

`RecommendationContext` ya admite `interestTags`, `favoriteCategories`, `historyItemIds`, GPS de usuario.

## Apps

| App | Adaptador | Wiring UI |
|-----|-----------|-----------|
| InfoSpot | sí | detalle de nota |
| CLF / Clickatón / FotoRank / FotoOffice | sí (stubs) | pendiente |
