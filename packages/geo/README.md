# @repo/geo — DNX GEO ENGINE

Infraestructura geográfica compartida del monorepo DNX Suite.

**No** es una feature de producto: es el motor que InfoSpot, ComprameLaFoto, Clickatón, FotoRank, FotoOffice y futuras apps deben reutilizar.

## Qué incluye

| Módulo | Export | Responsabilidad |
|--------|--------|-----------------|
| Coordenadas | `@repo/geo/coordinates` | Validación, rechazo `0,0` |
| Distancia | `@repo/geo/distance` | Haversine km/m, bbox, labels |
| Geohash | `@repo/geo/geohash` | Encode + prefijos por radio |
| Normalización | `@repo/geo/normalize` | Ciudad/provincia/país |
| Ubicación | `@repo/geo/location` | Contrato `DnxLocation` + alcance |
| Nominatim | `@repo/geo/nominatim` | Search / reverse (servidor) |
| Ranking | `@repo/geo/ranking` | `GeoRankingEngine` con pesos |
| Nearby | `@repo/geo/nearby` | Plan bbox/geohash + filtro memoria |
| Feed | `@repo/geo/feed` | Contrato `GeoFeedItem` (futuro) |
| Adaptadores | `@repo/geo/adapters` | Mapeo por app |
| React | `@repo/geo/react` | UI liviana (sin Leaflet) |

## Qué NO incluye

- Leaflet / MapPicker (queda en cada app: assets CSS, tiles, marca)
- Prisma / SQL de negocio
- Auth, rate-limit de APIs Next
- Reglas editoriales InfoSpot (`publish-rules`, sync CLF)
- EXIF GPS fotográfico

## Contrato `DnxLocation`

```ts
type DnxLocation = {
  geographicScope?: GeographicScope | null;
  countryCode?: string | null;
  countryName?: string | null;
  provinceName?: string | null;
  cityName?: string | null;
  placeName?: string | null;
  address?: string | null;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
};
```

## Integrar una app nueva

1. Depender de `"@repo/geo": "workspace:*"`.
2. Mapear entidades con un adaptador en `src/adapters/<app>.ts` (o local).
3. Geocoding solo vía proxy server-side + `createNominatimProvider`.
4. Nearby: `planNearbyQuery` → prefiltro Prisma → `filterNearbyInMemory`.
5. Ranking: `rankGeoItems(items, origin, weights)`.
6. UI: `@repo/geo/react` + mapa local si hace falta.

## Tests

```bash
pnpm --filter @repo/geo test
pnpm --filter @repo/geo check-types
```

## Documentación ampliada

Ver `docs/geo/dnx-geo-engine.md`.
