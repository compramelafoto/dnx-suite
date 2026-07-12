# Georreferenciación de eventos Info Spot

## Propósito

Todo evento editorial debe poder asociarse a una ubicación válida (país, provincia, ciudad, lugar, dirección, lat/lng) con estado de geocodificación y visibilidad pública. La **publicación** exige coordenadas válidas **y** confirmación explícita.

## Modelo (`InfoSpotEvent`)

Campos existentes reutilizados: `city`, `province`, `address`, `venueName` (= locationName CLF), `latitude`, `longitude`.

Campos nuevos: `postalCode`, `countryCode`, `countryName`, `geohash`, `locationPrecision`, `geocodingProvider`, `geocodingPlaceId`, `geocodingStatus`, `geocodedAt`, `locationConfirmedAt`, `locationConfirmedByUserId`, `locationVisibility`, `locationOverridden`, `coordinatesOverridden`.

### Estados `geocodingStatus`

`PENDING` · `GEOCODED` · `CONFIRMED` · `FAILED` · `NEEDS_REVIEW`

### Precisión

`COUNTRY` · `PROVINCE` · `CITY` · `NEIGHBORHOOD` · `VENUE` · `ADDRESS` · `COORDINATE`

### Visibilidad pública

| Valor | Comportamiento |
|-------|----------------|
| `EXACT` | Lugar + dirección + ciudad; coords internas pueden mostrarse en contextos internos |
| `APPROXIMATE` | Lugar/zona + ciudad; sin número |
| `CITY_ONLY` | Ciudad + provincia (default) |
| `HIDDEN` | Texto genérico; sin coords públicas |

`buildPublicEventLocation(event)` aplica estas reglas.

## Proveedor

Interfaz `GeocodingProvider` (`search` / `reverse` / `normalize`).

**Default:** Nominatim (OpenStreetMap), mismo criterio que CLF — **sin API key**. Solo vía servidor (`/api/geocode`, `/api/redaccion/geocode`).

Variables opcionales:

- `GEOCODING_PROVIDER=nominatim|manual`
- `GEOCODING_USER_AGENT=...` (política Nominatim)

Fallback: marcador manual + `ManualGeocodingProvider`. Mapbox/Google reservados si aparecen credenciales en el futuro.

## Flujos

### Redacción

Panel «Ubicación del evento»: búsqueda, sugerencias, mapa Leaflet (drag), confirmación. Sin confirmación no se publica.

### Público (`/publicar-evento`)

Mapa simplificado. Puede enviarse sin confirmar → `NEEDS_REVIEW`. No bloquea el intake si falla el proveedor.

### Inbound CLF

- Coords válidas → `GEOCODED` (no auto-`CONFIRMED`)
- Ausentes o `0,0` → `NEEDS_REVIEW` + warning
- Overrides: `locationOverridden` / `coordinatesOverridden` impiden que inbound pise correcciones editoriales

### Outbound CLF

Provisioning exige ciudad + coords válidas + `locationConfirmedAt`. Si falta → `BLOCKED` («Falta georreferenciar el evento»).

## Checklist

Publicar / aprobar requiere geo confirmada. Guardar y enviar a revisión **no**.

## Geohash y cercanía

`encodeGeohash` precisión 7 (~150 m). Helpers: `distanceBetweenCoordinates`, `isWithinRadius`, `buildBoundingBox`. Motor de recomendaciones: etapa futura.

## Privacidad

No exponer coords si `HIDDEN`. No usar EXIF de fotos como fuente pública. Logs sin secretos.

## Cache

Cache en memoria de búsquedas/reverse (TTL 5 min) para evitar llamadas idénticas inmediatas.

## CLI / tests

```bash
pnpm --filter infospot test:geolocation
```
