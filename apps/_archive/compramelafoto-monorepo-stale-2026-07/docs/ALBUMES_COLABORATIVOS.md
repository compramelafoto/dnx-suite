# Álbumes colaborativos, eventos y multi-entrega

## Reglas de matching

Al crear un álbum nuevo, se buscan coincidencias para sugerir unión:

### Sugerir coincidencias
- **Distancia**: <= 2000 m (haversine)
- **Ventana de tiempo**: abs(startAt - new.startAt) <= 6 horas

### Auto-join
- **Distancia**: <= 200 m
- **Ventana de tiempo**: <= 3 horas
- **Tipo de evento**: mismo `type`

## Alias de slugs

- Tabla `AlbumSlugAlias`: `aliasSlug` (único) -> `targetAlbumId`
- Ruta pública `/a/[slug]`:
  1. Buscar Album por `publicSlug`
  2. Si no existe, buscar `AlbumSlugAlias` por `aliasSlug`
  3. Si existe alias → redirect 301 a `/a/{targetAlbum.publicSlug}`

## Eventos (organizador)

- Al crear un evento, el organizador puede completar **Indicaciones para acreditación** (`accreditationNotes`).
- Ese texto se muestra al fotógrafo en la vista del evento para que sepa cómo acreditarse (ej. “Registrarse en el stand de prensa”, “Enviar mail a prensa@evento.com”, etc.).

## Multi-entrega en checkout

- Carrito único agrupa items por `authorId` (fotógrafo que subió la foto)
- `OrderFulfillmentGroup`: un grupo por fotógrafo, con `deliveryType` y `pickupAddress`
- `pickupAddress` = dirección del fotógrafo (User: address, city, province, postalCode, country)
- Si hay más de un fotógrafo: mostrar warning + checkbox obligatorio "Entiendo que habrá entregas/retiros separados"
