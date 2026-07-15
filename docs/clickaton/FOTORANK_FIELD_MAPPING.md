# Clickaton ↔ FotoRank — mapeo de campos (Etapa 07)

**Fuente Clickaton:** `apps/clickaton/types/marathon.ts`, `types/public/*`  
**Fuente FotoRank:** `packages/db` (`Fotorank*`) + loaders `apps/fotorank/app/lib/fotorank/*`

Estados: `EXISTE` · `PARCIAL` · `AUSENTE` · `LEGACY` · `REQUIERE_CALCULO` · `REQUIERE_AUTH` · `NO_EXPONER`

Visibilidad: `public` · `authenticated` · `internal` · `never`

---

## 1. `PublicMarathon` (estructural)

| Campo Clickaton | Fuente FotoRank | Estado | Transformación | Visibilidad | Endpoint futuro | Prioridad |
|-----------------|-----------------|--------|----------------|-------------|-----------------|-----------|
| `id` | `FotorankContest.id` | EXISTE | string → string | public | ficha/listado | P0 |
| `slug` | `FotorankContest.slug` | EXISTE | — | public | ficha/listado | P0 |
| `name` | `title` | EXISTE | rename | public | ficha/listado | P0 |
| `editionName` | — / parse title | AUSENTE | nuevo campo o convención | public | ficha | P1 |
| `shortDescription` | `shortDescription` | EXISTE | — | public | ficha/listado | P0 |
| `fullDescription` | `fullDescription` | EXISTE | — | public | ficha | P0 |
| `status` (`MarathonStatus`) | `status` + fechas | REQUIERE_CALCULO | mapear DRAFT/PUBLISHED/… → ciclo maratón | public | ficha/listado | P0 |
| `registrationStatus` | fechas + futuro registration | REQUIERE_CALCULO | — | public | ficha | P0 |
| `format` / `modality` | — | AUSENTE | campo nuevo o default `individual` | public | ficha | P1 |
| `featured` | — | AUSENTE | flag nuevo | public | listado | P2 |
| `isDemo` | — | AUSENTE | solo Clickaton/fixture | public | — | — |
| `city` | org.`city` o nuevo en contest | PARCIAL | preferir sede de edición | public | ficha/listado | P0 |
| `provinceOrRegion` | — | AUSENTE | nuevo | public | ficha | P0 |
| `country` | org.`country` | PARCIAL | — | public | ficha | P0 |
| `venueName` / `meetingPoint` | — | AUSENTE | venue model o texto | public | ficha | P1 |
| `timezone` | — | AUSENTE | **obligatorio** para ventanas | public | ficha | P0 |
| `startAt` / `endAt` | `startAt` / ? | PARCIAL | falta `endAt` nativo | public | ficha | P0 |
| `registrationOpenAt/CloseAt` | derivado / `submissionDeadline` | PARCIAL | migrar a windows | public | ficha | P0 |
| `participantLimit` | — | AUSENTE | capacity satélite | public | ficha | P1 |
| `minimumAge` | `rulesData` participación? | PARCIAL | parse rules o campo | public | ficha | P1 |
| `allowedDevices` | rules / categorías | PARCIAL | normalizar enum Clickaton | public | ficha | P1 |
| `coverImage` | `coverImageUrl` | EXISTE | URL → asset | public | ficha/listado | P0 |
| `galleryPreview` | entries destacadas | AUSENTE | satélite gallery | public | ficha | P2 |
| `organizer` | `ContestOrganization` | PARCIAL | map profile DTO | public | ficha | P0 |
| `localVenue` | — | AUSENTE | modelo sede | public | ficha | P2 |
| `categories[]` | `FotorankContestCategory` ACTIVE | PARCIAL | sin age/capacity vivos | public | ficha | P0 |
| `schedule[]` | fechas planas + futuro | PARCIAL | generar items o modelo | public | ficha | P1 |
| `prizes[]` | `prizesSummary` + JSON prizes | PARCIAL | normalizar array | public | ficha | P1 |
| `jury[]` | judge assignments + public profiles | PARCIAL | solo `isPublic` | public | ficha | P0 |
| `sponsors[]` | `sponsorsText` / JSON | PARCIAL | parse o modelo | public | ficha | P2 |
| `faq[]` | — / rules | AUSENTE | CMS o JSON | public | ficha | P2 |
| `rules` | `rulesText` + `rulesData` | PARCIAL | **no** exponer JSON crudo | public | ficha | P0 |
| `validationPolicy` | — | AUSENTE | copy + flags | public | ficha | P1 |
| `resultsStatus` / `galleryStatus` | `resultsAt` + flags | REQUIERE_CALCULO | | public | ficha | P1 |
| `challenges[]` | — | AUSENTE | filtrar liberadas | public* | ficha | P0 |
| `createdAt` / `updatedAt` | timestamps contest | EXISTE | ISO | public | ficha | P2 |
| `rulesData` completo | Json | NO_EXPONER | strip economía/jurado interno | never | — | — |
| `authorUserId` en entries | Entry | NO_EXPONER | | never | — | — |

\* consignas: solo subset sanitizado.

---

## 2. Visibilidad listado / ficha

| Regla Clickaton | Fuente FR | Estado | Transformación |
|-----------------|-----------|--------|----------------|
| listed | PUBLIC + status publicado + no draft | PARCIAL | Excluir UNLISTED del listado; UNLISTED solo ficha con link (hoy landing FR no sirve UNLISTED) |
| routable | slug + visibility | PARCIAL | Alinear UNLISTED |
| indexable | futuro | AUSENTE | robots por edición |

Loader actual: `visibility: PUBLIC` + `status in [PUBLISHED, ACTIVE]` — `ACTIVE` es **LEGACY**.

---

## 3. Satélites de inscripción y capacidad

| Contrato / campo | Fuente FR | Estado | Visibilidad | Endpoint futuro | Prioridad |
|------------------|-----------|--------|-------------|-----------------|-----------|
| `PublicRegistrationOffer.*` | economy JSON | PARCIAL / AUSENTE real | public | `.../offer` | P0 |
| `requiresAuthentication` | — | AUSENTE | public | offer | P0 |
| `requiresPayment` / precios | `entryMode`, `entryFeeAmount` | PARCIAL (simulado) | public | offer | P0 |
| `registrationUrl` | — | AUSENTE | public | offer | P1 |
| `RegistrationEligibility` | — | AUSENTE | authenticated | `.../eligibility` | P0 |
| `ParticipantRegistrationSummary` | — | AUSENTE | authenticated | `.../me/registration` | P0 |
| `PublicCapacity` | — | AUSENTE | public (agregado) | `.../capacity` | P1 |
| `PublicCategoryCapacity` | `maxFiles` ≠ cupo | AUSENTE | public | capacity | P1 |
| `PublicMarathonCapabilities` | fechas + flags | REQUIERE_CALCULO | public | `.../capabilities` | P1 |

---

## 4. Cronograma y bases

| Contrato | Fuente FR | Estado | Visibilidad | Notas |
|----------|-----------|--------|-------------|-------|
| `PublicScheduleWindow` | fechas contest | PARCIAL | public | Separar registration/capture/upload |
| `PublicScheduleItem` | — | AUSENTE | public | Agenda editorial |
| `PublicRulesDocument` | rulesText | PARCIAL | public | |
| `PublicRulesVersion` | — | AUSENTE | public | hash + acceptance |
| `PublicEventNotice` | — | AUSENTE | public | |

---

## 5. Validación / consignas

| Contrato | Fuente FR | Estado | Visibilidad | Prioridad |
|----------|-----------|--------|-------------|-----------|
| `PublicValidationPolicy` | — | AUSENTE | public | P1 |
| `PublicValidationRule` | — | AUSENTE | public | P1 |
| Detalle antifraude GPS | — | AUSENTE | never | P2 |
| `PublicChallenge` | — | AUSENTE | public filtrado | P0 |
| Challenge texto pre-release | — | — | never | P0 |

---

## 6. Resultados y galería

| Contrato | Fuente FR | Estado | Visibilidad | Transformación |
|----------|-----------|--------|-------------|----------------|
| `PublicMarathonResults` | agregación votos interna | PARCIAL interno / AUSENTE público | public when published | DTO nuevo; ocultar PII |
| Rankings / menciones / awards | votes + premios JSON | AUSENTE como recurso | public | |
| `PublicMarathonGallery` | entries | AUSENTE | public | consent + crédito |
| `PublicGalleryImage.purchaseUrl` | CLF | AUSENTE | public | integración futura |
| `publicationConsent` | — | AUSENTE | internal→public gate | |

---

## 7. Organizador / jurado / sponsor / premio

| Campo | Fuente | Estado | Visibilidad |
|-------|--------|--------|-------------|
| `PublicOrganizer.name/logo/city/country/website` | `ContestOrganization` | PARCIAL | public |
| `contactEmail` / phone org | org | PARCIAL | **public solo si flag**; default internal |
| `PublicVenue` | — | AUSENTE | public |
| `PublicJuryMember` | profile `isPublic` | PARCIAL | public |
| Pricing jurado / email juez | profile/account | NO_EXPONER | never |
| `PublicSponsor` | sponsorsText / JSON | PARCIAL | public |
| `PublicPrize` | prizesSummary / JSON prizes | PARCIAL | public |

---

## 8. Auth surfaces (no satélites anónimos)

| Necesidad | Estado | Visibilidad | Endpoint futuro |
|-----------|--------|-------------|-----------------|
| SSO Identity en Clickaton | PARCIAL (package existe) | authenticated | Identity hosts |
| Sesión jurado | EXISTE (FR only) | internal FR | no Clickaton |
| Upload fotos participante | AUSENTE | authenticated | FR participant API |

---

## 9. Transformaciones recurrentes

1. **Status:** `FotorankContestStatus` (+ fechas) → `MarathonStatus` / `RegistrationStatus` / `ResultsStatus`.  
2. **Strip `rulesData`:** publicar solo bloques seguros (texto bases, premios públicos).  
3. **Jurado:** filtrar `profile.isPublic`.  
4. **Consignas:** `releaseAt <= now` ∧ status ∈ {released, closed} ∧ título.  
5. **Legacy:** `ACTIVE` → tratar como PUBLISHED; `SETUP_IN_PROGRESS` → DRAFT.  
6. **Fechas:** siempre ISO-8601 + `timezone` IANA.

---

## 10. Endpoints públicos V1

### Implementados (Etapa 08B — FotoRank)

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| GET | `/api/public/v1/events` | no | listado envelope V1 (`FotorankPublicEventListItemV1[]`) |
| GET | `/api/public/v1/events/:slug` | no | ficha envelope V1 (`FotorankPublicEventV1`) |

Notas 08B:

- Ruta genérica **`events`** (no `marathons` / `contests`): contrato común para tipos futuros.
- Hoy `eventType: "contest"`; no existe `MARATHON` en Prisma.
- Sin CORS abierto; consumo previsto **server-to-server** desde Clickaton (08D pendiente).
- Caché: `public, s-maxage=60, stale-while-revalidate=300`.
- Errores: `INVALID_REQUEST` (400), `EVENT_NOT_FOUND` (404), `INTERNAL_ERROR` (500).
- Doc: `apps/fotorank/app/api/public/v1/README.md`.

### Futuros (no implementados)

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| GET | `/api/public/v1/events/:slug/offer` | no | `PublicRegistrationOffer` |
| GET | `/api/public/v1/events/:slug/capabilities` | no | capabilities |
| GET | `/api/public/v1/events/:slug/capacity` | no | capacity |
| GET | `/api/public/v1/events/:slug/results` | no | results if published |
| GET | `/api/public/v1/events/:slug/gallery` | no | gallery if published |
| GET | `/api/public/v1/events/:slug/eligibility` | session | eligibility |
| GET | `/api/me/registrations` | session | summaries |

---

## 11. Relación con Etapa 06

El adaptador Clickaton **no** debe mapear Prisma. Debe consumir estos DTOs (o equivalentes HTTP) y pasar por `normalize` + `sanitize` existentes.
