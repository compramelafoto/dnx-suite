# Motor de distribución de home — Info Spot

## Propósito

La home muestra **contenido real** (eventos y artículos) según reglas editoriales y operativas, no mocks.

```text
Contenido PUBLISHED + REAL
        ↓
Reglas + score + placements
        ↓
Bloques de home
```

## Regla pública central

`apps/infospot/lib/distribution/public-rules.ts`

Solo:

* `status = PUBLISHED`
* `contentTag = REAL`
* `excludeFromHomepage = false` (bloques automáticos)

Nunca: DRAFT, IN_REVIEW, READY_TO_PUBLISH, UNPUBLISHED, ARCHIVED, DEMO, NEEDS_REVIEW.

## Bloques

| Bloque | Fuente |
|--------|--------|
| Banner | `InfoSpotHomepagePlacement` HERO + fallback |
| Destacados | score (`calculateEventRelevanceScore`) |
| Próximos | `startAt >= now`, orden temporal |
| Buscan fotógrafos | automático vía `isClfEventPublicPhotographerCall` |
| Cerca tuyo | geo confirmada + radio (query `lat`/`lng`) |
| Coberturas | artículos REAL vinculados a evento/CLF |

## Placements

Modelo `InfoSpotHomepagePlacement` (HERO | FEATURED_EVENT). XOR article/event. Vigencia `startsAt`/`endsAt`. No se borra al vencer: se ignora o se desactiva.

Admin: `/redaccion/distribucion` (Director o redactor con publicación directa).

## Score

Temporal + geo confirmada + completitud + visitas recientes (si hay) + clics inscripción + bonus convocatoria + `editorialPriority` + frescura.

No publica contenido inválido.

## Convocatorias

Sin switch manual. CTA → `/api/r?to={CLF}/e/{slug}` (tracking + anti open-redirect) → ComprameLaFoto.

## Métricas

`InfoSpotContentMetricDaily` (`EVENT_VIEW`, `ARTICLE_VIEW`, `CLF_REGISTRATION_CLICK`, …). Rate limit naive por IP.

## Cache

`unstable_cache` ~60–120s con tags `infospot-home*`. Revalidación al publicar / cambiar placements.

## Pendiente

Álbumes como oportunidades, selector de fotos, perfiles de intereses, ML, notificaciones.
