# 16 — Reporte Dominio: organizador / eventos / landings

**Fecha:** 2026-07-04  
**Archivo modificado:** `packages/db/prisma/schema.prisma`  
**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto/prisma/schema.prisma`  
**Guía:** [`15-prisma-final-gap-analysis.md`](./15-prisma-final-gap-analysis.md)

**Restricciones respetadas:**

- ✅ Solo `packages/db/prisma/schema.prisma`
- ✅ `npx prisma validate` + `npx prisma format --check`
- ❌ Sin migraciones, `generate`, `migrate`, `db push`, `db pull`
- ❌ Sin cambios en `apps/*`

---

## Veredicto

| Comando | Resultado |
|---------|-----------|
| `npx prisma validate` | ✅ **Schema válido** |
| `npx prisma format --check` | ✅ **Formateado** (tras `prisma format` automático por desalineación menor) |

---

## Resumen cuantitativo

| Métrica | Post Dominio 14 | Post Dominio 9 | Δ |
|---------|----------------:|---------------:|--:|
| Modelos | 211 | **219** | **+8** |
| Enums | 152 | **155** | **+3** |
| Líneas (git diff) | — | — | **+285 / −43** |

---

## 1. Modelos agregados (8)

Bloque `// BEGIN LEGACY MERGE — dominio 9 organizador / eventos / landings (modelos)`:

| Modelo | Propósito |
|--------|-----------|
| `EventNearbyPhotographerNotification` | Registro anti-duplicado de convocatoria a fotógrafos cercanos |
| `EventFolder` | Carpetas jerárquicas del evento (organizador / fotógrafo) |
| `EventInterest` | Captación de interés previo a galería |
| `OrganizerEventDownload` | Tracking real de descargas en alta del organizador |
| `OrganizerPublicProfile` | Landing pública del organizador (`/o/[slug]`) |
| `OrganizerOfficialPhotographer` | Fotógrafos oficiales en landing |
| `OrganizerFeaturedGallery` | Galerías/eventos destacados en landing |
| `OrganizerLandingSponsor` | Sponsors en landing (fase posterior) |

> **Nota:** No existen entidades `EventLanding` ni `EventOrganizer` en legacy; landings = `OrganizerPublicProfile` + hijos.

---

## 2. Modelos fusionados (5 existentes)

| Modelo | Cambios |
|--------|---------|
| **`Event`** | +14 campos escalares (`status`, `uploadsEnabled`, `photographerTerms`, comisión organizador ×4, pricing foto ×5, `nearbyPhotographersAutoNotifiedAt`); +6 relaciones |
| **`EventMember`** | +`termsAcceptedAt`, +`termsAcceptedText` |
| **`User`** | +7 relaciones dominio 9 |
| **`Album`** | +`organizerDownloads`, +`organizerFeaturedGalleries` |
| **`Photo`** | +`eventFolder` (FK `eventFolderId` ya existía), +`organizerDownloads` |

---

## 3. Enums agregados (3)

| Enum | Valores |
|------|---------|
| `EventPhotoPricingMode` | `PHOTOGRAPHER_DECIDES`, `ORGANIZER_FIXED`, `ORGANIZER_MINIMUM` |
| `EventFolderScope` | `ORGANIZER`, `PHOTOGRAPHER` |
| `EventStatus` | `ACTIVE`, `CLOSED` |

---

## 4. Relaciones completadas

| Modelo | Relación | Destino |
|--------|----------|---------|
| `Photo` | `eventFolder` | `EventFolder` |
| `Photo` | `organizerDownloads` | `OrganizerEventDownload[]` |
| `User` | `eventNearbyPhotographerNotifications` | `EventNearbyPhotographerNotification[]` |
| `User` | `organizerEventDownloads` | `OrganizerEventDownload[]` (`OrganizerEventDownloadOrganizer`) |
| `User` | `photographerEventDownloads` | `OrganizerEventDownload[]` (`OrganizerEventDownloadPhotographer`) |
| `User` | `organizerPublicProfile` | `OrganizerPublicProfile?` |
| `User` | `organizerOfficialPhotographerListings` | `OrganizerOfficialPhotographer[]` |
| `User` | `eventFoldersCreated` | `EventFolder[]` (`EventFolderCreator`) |
| `User` | `eventFoldersOwnedPhotographer` | `EventFolder[]` (`EventFolderOwnerPhotographer`) |
| `Album` | `organizerDownloads` | `OrganizerEventDownload[]` |
| `Album` | `organizerFeaturedGalleries` | `OrganizerFeaturedGallery[]` |
| `Event` | `eventFolders`, `interests`, `organizerDownloads`, `organizerFeaturedGalleries`, `nearbyPhotographerNotifications` | Modelos D9 |

---

## 5. Conflictos encontrados

| ID | Conflicto | Resolución |
|----|-----------|------------|
| — | Ninguno | Merge directo desde legacy |

---

## 6. Relaciones diferidas (fuera de scope — dominio 6 video)

| Modelo | Relación legacy omitida | Motivo |
|--------|-------------------------|--------|
| `EventFolder` | `videos` → `VideoAsset[]` | Modelo `VideoAsset` ausente |
| `Album` | `videos` → `VideoAsset[]` | Modelo `VideoAsset` ausente |
| `User` | `uploadedVideos` → `VideoAsset[]` | Modelo `VideoAsset` ausente |

---

## 7. Pendientes post-dominio 9

| # | Pendiente | Dominio |
|---|-----------|---------|
| P1 | `VideoAsset`, `VideoProcessingJob` + relaciones video | 6 |
| P2 | Cuánto Cobro (9 modelos, 6 enums) | 11 |
| P3 | Blog / marketing / leads (15 modelos, 5 enums) | 12 |
| P4 | `EventMember` ya cerrado; `Template.@@index([version])`, campos `User` residuales (payout, blog, etc.) | 16 |
| P5 | Migración forward SQL | Fase SQL |

---

## 8. Suite intacta

- **FotoOffice** / **FotoRank** — sin modelos tocados; solo relaciones `User` compartidas necesarias para D9.

---

## Diff resumido

```
packages/db/prisma/schema.prisma | +285 −43
```

**Bloques añadidos:**

- `BEGIN/END LEGACY MERGE — dominio 9 organizador / eventos / landings (enums)` — 3 enums
- `BEGIN/END LEGACY MERGE — dominio 9 organizador / eventos / landings (modelos)` — 8 modelos
- Merges inline en `Event`, `EventMember`, `User`, `Album`, `Photo`
