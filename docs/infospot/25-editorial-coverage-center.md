# Centro Editorial de Coberturas — Info Spot

## Propósito

Inbox **álbum-first** para redacción: cada álbum público de ComprameLaFoto aparece como una `InfoSpotCoverage` sincronizada de forma idempotente.

```text
Álbum público CLF
      ↓ sync idempotente
InfoSpotCoverage (hub)
      ↓ 1..N
InfoSpotArticle (notas editoriales)
```

No publica automáticamente. No modifica CLF. No rompe inbound/outbound de eventos.

## Arquitectura

| Capa | Ubicación |
|------|-----------|
| Schema | `InfoSpotCoverage`, `InfoSpotCoveragePhotographer`, `InfoSpotCoverageArticle` |
| Sync | `apps/infospot/lib/coverage/sync.ts` + `clf-albums.ts` + `queries.ts` |
| UI | `/redaccion/coberturas` y `/redaccion/coberturas/[id]` |
| Acciones | `apps/infospot/app/actions/coverage.ts` |
| Stubs | `ai-stub.ts`, `photo-selector-stub.ts`, `credits-stub.ts` |

## Cobertura

Una cobertura = **un** `clfAlbumId` (`@@unique`).  
Incluye snapshot operativo, estado comercial, estado editorial agregado, fotógrafos y vínculos a artículos.

## Sincronización

1. Lee álbumes públicos CLF (`isPublic`, no `isTest`, no `deletedAt`, con fotos).
2. `upsertCoverageFromAlbumSnapshot` por `clfAlbumId`.
3. Refresca fotógrafos (dueño + colaboradores + contributors).
4. Álbumes que dejan de estar en el feed → `syncStatus = STALE`, CTA off.

Idempotente: re-sync no duplica filas.

## Estados

| Campo | Valores |
|-------|---------|
| `discoveryStatus` | DISCOVERED / QUEUED / DISMISSED / LINKED |
| `editorialStatus` | UNASSIGNED / DRAFTING / IN_REVIEW / READY / PUBLISHED / STALE |
| `syncStatus` | PENDING / SYNCED / FAILED / STALE / DISABLED |
| `commercialStatus` | AVAILABLE / REACTIVATABLE / UNAVAILABLE / UNKNOWN |

Editorial se **deriva** de artículos vinculados + sync; no publica.

## Relación con eventos

`clfEventId` / `eventTitle` denormalizados del álbum.  
Al crear nota se vincula también origen EVENT si existe.

## Relación con álbumes

Soft ref `clfAlbumId`. URL pública vía `resolveClfAlbumCommercialAvailability`.  
Álbum oculto/eliminado → sin CTA.

## Relación con artículos

`InfoSpotCoverageArticle` M:N (PRIMARY / FOLLOW_UP / GALLERY_ONLY).  
Soft refs `InfoSpotArticle.clfAlbumId` / `eventId` se mantienen.

## Estados comerciales

Reutiliza `@repo/db` `resolveClfAlbumCommercialAvailability`.  
CTA solo si `canShowPurchaseCta`.

## Preparación IA

`aiPrepStatus` + `aiPrepMeta` + `buildAiPrepContract` / `buildCoverageSummaryStub`.  
Sin LLM en esta etapa.

## Preparación selector de fotos

`photoSelectorStatus` + meta con `endpointHint` → `/api/redaccion/clf-albums/{id}/photos`.  
Etapa 9 implementará la UI completa.

## Créditos

`creditsStatus` + `buildCreditsPrep` usando `clf-credit.ts`.  
Listo para auto-crédito al importar fotos.

## Flujo editorial

1. Sync álbumes  
2. Abrir cobertura  
3. Ver comercial / editorial / fotógrafos  
4. Crear nota (DRAFT REAL) o abrir nota existente  
5. Descartar si no interesa  

## Futuras etapas

- **Etapa 9 — Selector Editorial de Fotografías** (créditos, compra, derechos, galerías).
- Scoring IA de fotos.
- Notificaciones de álbumes nuevos.
- Reconciliación periódica programada.

## Migración

`20260712240000_infospot_editorial_coverage_center` — solo staging.
