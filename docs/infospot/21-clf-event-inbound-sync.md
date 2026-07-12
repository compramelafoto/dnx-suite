# Sync inbound: eventos CLF → InfoSpotEvent

## Propósito

Importar eventos públicos de ComprameLaFoto como **borradores** editoriales en Info Spot, vinculados con `InfoSpotContentOrigin`, sin publicar automáticamente.

```text
Evento público CLF
  → sync idempotente
  → InfoSpotEvent DRAFT (originKind=IMPORTED, contentTag=NEEDS_REVIEW)
  → revisión editorial humana
```

## Criterio de importación

Se importa si:

```text
visibility = PUBLIC
AND archivedAt IS NULL
AND shareSlug IS NOT NULL
AND title no vacío
AND startsAt presente
```

Reglas adicionales:

| Situación CLF | Comportamiento |
|---------------|----------------|
| `ACTIVE` o `CLOSED` + público | Se importa / actualiza. CLOSED no borra la ficha. |
| `PRIVATE` / `UNLISTED` | No crea nuevo. Si ya vinculado: retira CTA/URL, conserva ficha. |
| `archivedAt` set | No crea nuevo. Si vinculado: origen `STALE`, retira CTA. |
| Sin título / sin fecha / sin shareSlug | No importa. |

## Mapeo de campos

| CLF | Info Spot | Ownership |
|-----|-----------|-----------|
| `title` | `title` inicial | editorial tras override |
| `description` | `description` / `summary` inicial | editorial tras override |
| `type` | categoría vía mapa | editorial tras override |
| `startsAt` / `endsAt` | `startAt` / `endAt` | SOURCE |
| `city` | `city` | SOURCE |
| `locationName` | `venueName` / `address` | SOURCE |
| `latitude` / `longitude` | mismas (null si 0,0) | SOURCE |
| `coverImageKey` | `coverImageKey` + URL R2 | AFTER_OVERRIDE |
| `shareSlug` | `registrationUrl` / `sourceUrl` = `{origin}/e/{slug}` | SOURCE |
| `creator.*` | organizador | SOURCE |
| — | `status` editorial | nunca tocado por sync |
| — | `slug` editorial | nunca tocado tras create |

Provincia: CLF no la tiene; se usa `creator.province` o placeholder `A confirmar`.

## Categorías (exhaustivo)

| EventType | Slug Info Spot |
|-----------|----------------|
| SPORTS | deportes |
| CONCERT, FESTIVAL, CONFERENCE, RELIGIOUS | cultura |
| PUBLIC_PHOTOGRAPHY, THEMATIC_SESSIONS, COMMERCIAL_SESSIONS, PUBLIC_SESSION, PRIVATE_SESSION | fotografia |
| SCHOOL, WEDDING, BIRTHDAY, GRADUATION, CORPORATE, OTHER | eventos |
| desconocido | eventos (fallback + warning) |

No se crean categorías automáticamente.

## Overrides (Opción A)

Columnas booleanas en `InfoSpotEvent`:

- `titleOverridden`
- `descriptionOverridden`
- `summaryOverridden`
- `categoryOverridden`
- `coverOverridden`

Al guardar desde Redacción, si el campo cambió se marca el flag. El sync no pisa campos con flag `true`.

## Convocatoria

En `operationalPayload`: `visibility`, `joinPolicy`, `maxPhotographers`, `activePhotographerCount`, `availableSlots`, `status`, `archivedAt`, `shareSlug`, `publicPhotographerCall`.

`isClfEventPublicPhotographerCall` es true solo si PUBLIC + OPEN + no archivado + shareSlug + ACTIVE + cupo disponible.

## Georreferenciación

Se importan coordenadas válidas. Si faltan (null o 0,0): warning + aviso en UI «Este evento todavía no está georreferenciado.» No se geocodifica en esta etapa.

## Ejecución

```bash
pnpm --filter infospot sync:clf-events -- --dry-run
pnpm --filter infospot sync:clf-events -- --dry-run --limit 20
pnpm --filter infospot sync:clf-events -- --limit 5
pnpm --filter infospot sync:clf-events -- --event-id 123
```

API: `reconcilePublicClfEvents({ dryRun, limit, eventId })`.

## Idempotencia

Unique parcial ContentOrigin `(sourceType, externalEntityType, externalId, eventId)`. Segunda corrida no duplica evento ni vínculo.

## Qué no implementa esta etapa

- Info Spot → CLF
- Formulario de convocatoria desde Info Spot
- Selector de fotos / álbumes como oportunidades
- Banner / destacados / home dinámica
- Notificaciones a suscriptores
- Geocodificación
- Cron automático (solo función lista)

## Soft refs de artículos

No se migran. Dry-run de backfill de artículos sigue disponible por separado y no relaciona `Article.eventId` con nuevos `InfoSpotEvent` automáticamente.
