# ETAPA 11 — Home inteligente por cercanía, fecha y feed unificado

## 1. Auditoría inicial

- Home server-first en `apps/infospot/app/page.tsx` (`force-dynamic`) con bloques adaptativos (`HomeAdaptiveSections` + `resolveHomeExperience`).
- Contenido publicable real: `InfoSpotArticle` (noticias/coberturas) e `InfoSpotEvent` (agenda + convocatorias vía `InfoSpotPhotographerCall`).
- Geo completo solo en eventos; artículos pueden heredar ciudad/coords del autor o quedar sin distancia.
- Ya existían Haversine (`lib/geo.ts`, `lib/geolocation/distance.ts`), prompt opt-in en `HomeNearYouBlock`, y cache `unstable_cache` con tags `infospot-home*`.
- No había feed unificado ni API `/api/public/feed`.

## 2. Arquitectura

```
SSR Home (feed general cacheado)
  → bloque unified_feed (HomeNovedadesFeed)
  → hidratación cliente + preferencia localStorage
  → GET /api/public/feed?lat&lng&cursor&locationMode
  → getPublicFeed() agrega Article+Event → score → diversify → cursor
```

## 3. Tipos de contenido incluidos

| Tipo feed | Fuente |
|-----------|--------|
| NEWS | Artículo publicado |
| COVERAGE | Artículo con coverage link / clfAlbumId |
| INTERVIEW / CHRONICLE / GUIDE / INSTITUTIONAL / CONTEST | Heurística categoría/título |
| EVENT | Evento publicado vigente |
| PHOTOGRAPHER_CALL | Evento con convocatoria elegible |

No se inventaron modelos Prisma nuevos.

## 4. Tablas / modelos

- `InfoSpotArticle`, `InfoSpotCategory`, `InfoSpotEditorialAsset`
- `InfoSpotEvent`, `InfoSpotPhotographerCall`, `InfoSpotContentOrigin`
- `InfoSpotHomepagePlacement` (exclusión hero/destacados)
- Preferencias de ubicación: **solo** `localStorage` (no DB)

## 5–6. Archivos creados / modificados

Ver informe de entrega en el chat / PR. Núcleo: `apps/infospot/lib/feed/*`, `components/home/HomeNovedadesFeed.tsx`, `app/api/public/feed/route.ts`.

## 7. Migraciones

Ninguna. Reutiliza schema existente.

## 8–9. Ranking y pesos

`calculateInfoSpotFeedScore` = freshness + proximity + editorial + timeSensitive.

Config central: `lib/feed/config.ts` (`FEED_CONFIG`).

Desempate: score → publishedAt → distance → editorialPriority → updatedAt → id.

## 10. Geolocalización

- Prompt no invasivo («Ver contenido cerca mío»).
- `navigator.geolocation.getCurrentPosition` solo tras CTA.
- Alternativa manual con centroides de ciudad.
- Modo «Todo el país» / borrar preferencia.

## 11. Privacidad

- Claves `infospot.location.preference.v1` / `infospot.location.permissionPrompt.v1`.
- Coordenadas redondeadas a 3 decimales en storage.
- Sin persistencia GPS en DB, sin logs de coords, analítica sin lat/lng.

## 12. Fallback

Sin GPS / denied / timeout / unavailable → feed general por fecha + editorial. Contenido sin coords no se excluye.

## 13. Caché

- `getCachedPublicFeedGeneral` tags: `infospot-home-feed`, `infospot-public-content`, `infospot-home` (90s).
- Invalidación al publicar artículo/evento y al editar placements.

## 14–20. QA

Ver sección «Entrega» del informe de la etapa.
