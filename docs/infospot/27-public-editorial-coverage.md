# Publicación pública de coberturas editoriales — Info Spot

## Propósito

Cerrar el ciclo público:

```text
Evento → Cobertura fotográfica → Álbumes CLF → Nota Info Spot → Fotos con crédito → CTA → Venta CLF
```

Info Spot es capa editorial y de descubrimiento. ComprameLaFoto gestiona álbumes, originales, precios, carrito, pagos y descargas.

## View model

`PublicEditorialCoverage` (`lib/public-coverage/types.ts`) reúne en una sola carga:

- artículo (slug/id)
- evento relacionado (si existe)
- cobertura + estado comercial
- `coverPhoto` / `inlinePhotos` / `galleryPhotos` / `featuredPhotos`
- `photoById` — mapa para TipTap sin N+1
- fotógrafos, álbumes AVAILABLE, relacionados, `ogImageUrl`

Resolver: `getPublicEditorialCoverageByArticleSlug(slug)` (cache 120s, tags `infospot-public-coverage`, `article-{slug}`).

Eventos: `getPublicEventCoverageBundle(slug)`.

## Artículo público (`/noticias/[slug]`)

- Encabezado: categoría, título, bajada, fecha, autor, ubicación, enlace a evento.
- Portada: usage `COVER` CLF prevalece; si no, asset tradicional; fallback Info Spot.
- Cuerpo: Markdown sanitizado; figuras con `data-photo-id` resuelven `PublicEditorialPhoto`.
- Galería GALLERY, fotógrafos, álbumes comerciales, relacionados.
- Tracking: `ARTICLE_VIEW` vía `/api/metrics/view`.

## Ficha de evento (`/eventos/[slug]`)

Ciclo temporal (`getEventTemporalState`):

| Estado | Etiqueta |
|--------|----------|
| UPCOMING | Próximamente |
| TODAY | Hoy |
| IN_PROGRESS | En curso |
| FINISHED | Finalizado |
| CANCELLED | Cancelado |

Prioridades UI: inscripción/convocatoria antes; coberturas/álbumes durante/después.

## Portada / inline / galería

- Solo derivados editoriales (`src` / `srcSet` / `sizes`).
- Crédito obligatorio (`EditorialPhotoCredit`).
- Protección disuasoria (`ProtectedEditorialImage`).
- Lightbox: variante grande + crédito + CTA; Escape / flechas; sin URL maestra.

## Fotógrafos y álbumes

- `CoveragePhotographers`: multi-autor, conteo por fotógrafo, CTA álbum/perfil.
- `CoverageAlbumsCommerce`: solo `AVAILABLE` + `canShowPurchaseCta`.

## CTA comerciales

| Situación | Texto |
|-----------|--------|
| URL de compra específica | Ver y comprar esta foto |
| Solo álbum | Buscar esta foto en el álbum |
| HIDDEN / UNPUBLISHED / DELETED / UNKNOWN | Sin CTA público |

Tracking seguro: `/api/r?to=&kind=&articleId=&eventId=` (anti open-redirect).

## Licencias

- `AUTHORIZED` + `READY` + variantes → se muestra.
- `REVOKED` → placeholder: «Esta fotografía ya no está disponible para publicación.»
- Álbum eliminado: la nota carga; derivados autorizados permanecen; CTAs desaparecen.

## SEO / Open Graph

- Metadata dinámica con imagen editorial estable (no signed URL corta).
- JSON-LD `NewsArticle` (+ `Event` / `ImageObject` / `Person` cuando aplica).
- Evento: canonical, fechas, lugar, estado.

## Accesibilidad

- Alt obligatorio (checklist bloquea publicación sin alt).
- Galería: teclado, labels, foco.
- Créditos legibles.

## Performance

- Una query de usos + fotos + variantes por artículo.
- Lazy en no-portada; `priority` en cover.
- Galería con límite inicial + «Ver más».
- Cache view model; `invalidatePublicCoverageCache` al cambiar usos/fotos.

## Reconciliación

- `reconcileEditorialPhotoCommercialStatus` (estado sincronizado, no CLF por visita).
- CLI: `pnpm --filter infospot reconcile:public-coverage`
- Acción redacción: `reconcileEditorialCommercialAction`

## Seguridad

- Props públicas sin storage keys ni originales.
- TipTap/Markdown sanitizado.
- Redirects validados en `/api/r`.

## Componentes

- `PublicEditorialPhoto`
- `PublicEditorialGallery`
- `EditorialPhotoCredit`
- `CoveragePhotographers`
- `CoverageAlbumsCommerce`
- `RelatedEventCoverage`
- `EventLifecycleSection`
- `ContentViewTracker`

## Tests

`pnpm --filter infospot test:public-coverage`
