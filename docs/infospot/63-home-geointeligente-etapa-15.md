# ETAPA 15 — Home geointeligente y ranking editorial

## Resumen

El Home de InfoSpot usa `@repo/geo` (`GeoRankingEngine`, `planNearbyQuery`, `filterNearbyInMemory`, distance helpers) para rankear el feed unificado y los bloques de cercanía.

## Ranking

Config central: `apps/infospot/lib/feed/config.ts` → `FEED_CONFIG.ranking.weights`

| Factor | Peso |
|--------|------|
| Cercanía | 40 % |
| Actualidad | 25 % |
| Prioridad editorial | 15 % |
| Popularidad | 10 % |
| Tipo de contenido | 10 % |

Capas InfoSpot adicionales (no alteran los % del motor): time-sensitive, featured, soft boost de alcance geográfico.

Implementación: `lib/feed/score.ts` → `scoreGeoItem` de `@repo/geo`.

## Modos de ubicación

| Modo | Origen | Comportamiento |
|------|--------|----------------|
| GPS | lat/lng | Ranking por distancia + alcance |
| Manual | ciudad/centroide | Igual que GPS |
| Nacional / none | sin origen | Fallback por frescura/editorial; nunca bloquea el Home |

## Bloques

- Feed unificado (`HomeNovedadesFeed`)
- Cerca tuyo (`HomeNearYouBlock` + `getNearbyEvents` con bbox)
- Próximas actividades cercanas / Convocatorias cercanas (`HomeNearbyFeedStrip`)
- También cerca de este lugar (`AlsoNearThisPlaceBlock` en detalle de nota)

## Performance

- Prefetch espacial con `planNearbyQuery` + `boundingBoxWhere` cuando hay origen
- Cache general SSR: `getCachedPublicFeedGeneral` (tag `infospot-home-feed`, 90s, key v2)
- Feed personalizado: API `force-dynamic` sin cache de coords

## Explicabilidad / métricas

- `rankingExplain` en ítems solo en `NODE_ENV=development`
- `FeedGenerationMetrics` en resultado del feed (dev)

## Futuro multiplataforma

- `infoSpotFeedItemToGeoFeedItem` + tipo `FutureMultiAppFeedIngest` (`enabled: false`)
- No se mezclan aún CLF/Clickatón/etc. en el Home
