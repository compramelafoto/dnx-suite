# DNX GEO ENGINE — Arquitectura (Etapa 14)

## Objetivo

Unificar geolocalización en `@repo/geo` para todo DNX Suite, sin romper InfoSpot ni ComprameLaFoto.

## Capas

```
┌─────────────────────────────────────────────┐
│ Apps (InfoSpot, CLF, Clickatón, …)          │
│  - APIs / auth / rate-limit                 │
│  - Leaflet MapPicker (marca / assets)       │
│  - Prisma queries + reglas de producto      │
└──────────────────┬──────────────────────────┘
                   │ adaptadores
┌──────────────────▼──────────────────────────┐
│ @repo/geo                                   │
│  coordinates · distance · geohash            │
│  normalize · location · nominatim           │
│  ranking · nearby · feed contract           │
│  react (UI liviana)                         │
└─────────────────────────────────────────────┘
```

## Responsabilidades

| Capa | Dueño |
|------|--------|
| Math + validación + Nominatim HTTP | `@repo/geo` |
| Contrato `DnxLocation` / `GeoFeedItem` | `@repo/geo` |
| Ranking genérico con pesos | `@repo/geo` |
| Plan nearby (bbox/geohash) | `@repo/geo` |
| Persistencia / sync CLF / publish rules | Apps |
| Mapas Leaflet | Apps |
| Notificaciones por radio | Futuro (Notifications Engine) |

## Adaptadores

| App | Estado Etapa 14 |
|-----|-----------------|
| InfoSpot | Adaptador + reexports parciales en geolocation/feed |
| ComprameLaFoto | Adaptador listo; lib/geo local aún en uso (migración gradual) |
| Clickatón | Adaptador (sedes textuales; coords cuando existan) |
| FotoRank | Stub |
| FotoOffice | Stub |

## Flujo recomendado (nueva feature cercana)

1. Adaptar entidad → `DnxLocation` / `GeoFeedItem`.
2. `planNearbyQuery(origin, radiusKm)`.
3. Query Prisma con `boundingBoxWhere` o `geohashPrefixWhere`.
4. `filterNearbyInMemory` para precisión Haversine.
5. Opcional: `rankGeoItems` con pesos de la app.

## Integración InfoSpot (Etapa 14)

- `lib/geolocation/{distance,geohash,coordinates}.ts` reexportan `@repo/geo`.
- `lib/feed/distance.ts` reexporta helpers de distancia/labels.
- `lib/editorial/article-location.ts` puede alinearse a `validateLocationForPublish` del package (compat mantenida).
- Nominatim de InfoSpot puede migrar a `createNominatimProvider` en un paso siguiente.

## Futuro

- Feed unificado multi-app (`GeoFeedItem`).
- Notifications Engine + geo (avisos por radio).
- Migrar CLF `lib/geo.ts` a thin reexport.
- Agregar lat/lng a sedes Clickatón.

## Env

- `GEOCODING_USER_AGENT` (recomendado)
- `GEOCODING_PROVIDER` (apps; default nominatim)
