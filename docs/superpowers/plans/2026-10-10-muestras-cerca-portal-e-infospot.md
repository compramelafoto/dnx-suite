# Muestras cerca tuyo + Muestras → InfoSpot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tarjeta "Muestras fotográficas cerca tuyo" en el portal del socio de FOTOFFICE, y publicación automática de las muestras de muestrasfotograficas.com en InfoSpot.

**Architecture:** Las reglas puras (elegir las 3 cercanas, convertir muestra → evento) viven en `@repo/muestras` y en `apps/infospot/lib/muestras-sync/normalize.ts`. FOTOFFICE lee `CulturalActivity` directo (misma base). Muestras expone `GET /api/public/actividades`; un cron de InfoSpot lo lee y crea/actualiza/retira `InfoSpotEvent` con `InfoSpotContentOrigin`.

**Tech Stack:** Next 16.2 (App Router), Prisma (`@repo/db`), vitest (FOTOFFICE, Muestras, `@repo/muestras`), tsx + node:assert (InfoSpot), Nominatim vía `@repo/geo`.

**Spec:** `docs/superpowers/specs/2026-10-10-muestras-cerca-portal-e-infospot-design.md`

## Global Constraints

- Sin migraciones, sin enums nuevos, sin variables de entorno nuevas.
- Textos en español rioplatense; fechas en hora argentina (`@repo/muestras` dates).
- El endpoint público nunca expone mails, teléfonos, ids de usuario ni `workspaceId`.
- La sync nunca cambia el estado editorial de un evento InfoSpot existente, salvo retirar (PUBLISHED → UNPUBLISHED) uno que dejó de venir.
- Ningún fallo de Nominatim, de la base o del endpoint rompe el portal ni el cron entero.
- URL pública de Muestras: `https://muestrasfotograficas.com` (constante).

## Review Focus

- Socio con ciudad escrita rara ("rosario", "Rosario, Sta Fe", vacía): cae al siguiente origen, nunca error. → test en Task 2.
- Muestra virtual sin coordenadas o sin ciudad: no aparece en la tarjeta ni se importa a InfoSpot. → tests en Task 1 y Task 4.
- Muestra que la redacción despublicó a mano en InfoSpot: la sync no la vuelve a publicar. → test en Task 4.
- Título editado a mano en InfoSpot (`titleOverridden`): la sync no lo pisa. → test en Task 4.
- Endpoint de Muestras caído o con JSON inválido: el cron responde error sin retirar todo (una lista vacía por falla NO debe despublicar). → test en Task 4.

---

### Task 1: Regla pura "las 3 más cercanas" en `@repo/muestras`

**Files:**
- Modify: `packages/muestras/src/nearby.ts`
- Test: `packages/muestras/src/nearby.test.ts`

**Interfaces:**
- Produces: `pickNearbyForPortal<A>(origin: Coords | null, items: A[], now: Date, limit = 3): (A & { distanceKm: number | null })[]` donde `A extends { latitude: number|null; longitude: number|null; startsAt: Date; endsAt: Date; isCancelled: boolean; isVirtualOnly: boolean }`.
  - Descarta canceladas, sólo virtuales, sin coordenadas y CLOSED.
  - Con origen: orden por distancia. Sin origen: orden por `startsAt` (abiertas primero, después próximas), `distanceKm` null.

- [ ] Step 1: tests (descarta cerradas/canceladas/virtuales/sin coords; ordena por distancia; sin origen ordena por fecha; recorta a 3).
- [ ] Step 2: `pnpm --filter @repo/muestras test` → FAIL.
- [ ] Step 3: implementar con `withDistance` y `temporalStatus`.
- [ ] Step 4: tests → PASS. Step 5: commit.

### Task 2: Origen del socio y consulta en FOTOFFICE

**Files:**
- Modify: `apps/fotoffice/package.json` (+ `"@repo/muestras": "workspace:*"`), `pnpm-lock.yaml` (`pnpm install`)
- Create: `apps/fotoffice/lib/muestras/origen.ts` (puro), `apps/fotoffice/lib/muestras/origen.test.ts`
- Create: `apps/fotoffice/lib/muestras/cerca.ts` (server-only: geocodificar con caché + consulta)

**Interfaces:**
- `textoDeLugar(city?: string|null, province?: string|null): string | null` → `"Rosario, Santa Fe, Argentina"`; null si no hay ciudad. Recorta espacios, ignora ciudad < 2 letras.
- `candidatosDeOrigen(member, institucion): string[]` → textos únicos en orden socio → institución.
- `loadMuestrasCerca({ memberId, workspaceId }): Promise<MuestrasCerca>` con
  `type MuestrasCerca = { lugar: string | null; origen: Coords | null; items: MuestraCercaView[] }` y
  `type MuestraCercaView = { slug; title; type; coverImageUrl; city; province; venueName; distanceLabel: string|null; dateText: string; lastDays: boolean; url: string }`, más `verTodasUrl: string`.
- Geocodificación: `unstable_cache(fn, ["fotoffice-geocode-v1"], { revalidate: 2592000 })`, Nominatim con `AbortSignal.timeout(3000)` vía `fetchImpl`, `limit: 1`, `countryCodes`/contexto AR si el provider lo acepta; si lanza, no se cachea y se prueba el siguiente.

- [ ] Steps: test de `textoDeLugar`/`candidatosDeOrigen` (vacíos, duplicados, espacios) → FAIL → implementar → PASS → commit.

### Task 3: Tarjeta en el portal

**Files:**
- Create: `apps/fotoffice/components/portal/muestras-cerca-card.tsx`
- Modify: `apps/fotoffice/components/portal/portal-home.tsx` (prop `muestrasCerca?: MuestrasCerca | null`, tarjeta en la columna lateral antes de concursos), `apps/fotoffice/app/portal/page.tsx` (cargar con try/catch como cumpleaños).

- Título "Muestras fotográficas cerca tuyo"; subtítulo "Cerca de <lugar>" o "En todo el país" + enlace a `/portal/perfil` si no hay lugar.
- Ítem: portada (`<img>`, 64 px, lazy), título, "Ciudad · a N km", fechas, chip "Últimos días". Enlaces externos `target="_blank" rel="noopener"`.
- "Ver todas cerca tuyo →" a `verTodasUrl`. Sin ítems → no se muestra la tarjeta.
- [ ] Steps: implementar, `pnpm --filter fotoffice check-types`, test vitest existente sigue verde, commit.

### Task 4: Muestras → InfoSpot

**Files:**
- Create: `apps/muestras/app/api/public/actividades/route.ts`, `apps/muestras/lib/actividades/exportables.ts`, `apps/muestras/lib/actividades/exportables.test.ts`
- Create: `apps/infospot/lib/muestras-sync/{types.ts,normalize.ts,fetch.ts,sync.ts,reconcile.ts,muestras-sync.test.ts}`
- Create: `apps/infospot/app/api/cron/muestras-sync/route.ts`
- Modify: `apps/infospot/vercel.json` (cron `*/30 * * * *`), `apps/infospot/package.json` (`test:muestras-sync` y sumarlo a `test`).

**Interfaces:**
- Muestras: `aExportable(a, base): ActividadExportable` (puro) y `export type ActividadExportable = { id; slug; type; title; description; organizersText; coverImageUrl; startsAt: string; endsAt: string; scheduleText; priceText; isVirtualOnly; venueName; address; city; province; latitude; longitude; url }`. Respuesta `{ v: 1, generatedAt, items }`, `Cache-Control: public, s-maxage=600, stale-while-revalidate=3600`. Filtro: APPROVED, no cancelada, `endsAt > now - 1 día`.
- InfoSpot:
  - `parseFeed(json: unknown): ActividadExportable[]` lanza si no tiene `v: 1` e `items` array (protege el retiro masivo).
  - `isImportable(a)` → ciudad y provincia no vacías y coordenadas válidas.
  - `normalizeMuestra(a): NormalizedMuestra` con title, summary (primeros 240 caracteres de description), description, startAt, endAt, venueName, city, province, address, latitude, longitude, coverImageUrl, sourceUrl=url, registrationUrl=url, organizerName=organizersText||"Muestras Fotográficas", organizerEmail=`muestras@dnxsuite.com`, organizerWebsite=`https://muestrasfotograficas.com`.
  - `buildMuestraUpdate(existing, normalized): { data; applied: string[] }` respeta `*Overridden` y `locationOverridden`/`coordinatesOverridden`; nunca toca `status`.
  - `reconcileMuestras({ dryRun, fetchImpl? }): Promise<{ scanned; created; updated; unchanged; withdrawn; skipped; failed }>`.
  - Retiro: orígenes `sourceType API`, `externalId` que empieza con `muestras:` y que no están en la lista → si el evento está PUBLISHED → UNPUBLISHED + `unpublishedAt`; origen STALE.
  - Crear: PUBLISHED, `publishedAt` now, `contentTag REAL`, `originKind SYNCED_EXTERNAL`, categoría `fotografia`, `geocodingStatus CONFIRMED`, `locationConfirmedAt` now, `locationPrecision COORDINATE`, `geocodingProvider "muestras"`, `locationVisibility EXACT`, geohash.
  - Tras escribir: `revalidateEventPaths(slug, id)` (sólo si no es dryRun y hubo cambios; dentro de try por si corre fuera de Next).

- [ ] Steps: tests puros (parseFeed rechaza basura; isImportable; normalize; buildMuestraUpdate con/sin override; no toca status) → FAIL → implementar → PASS; aExportable no filtra campos privados (test que verifica claves exactas) → commit.

### Task 5: Verificación, PR y puesta en marcha

- [ ] `pnpm --filter @repo/muestras test`, `pnpm --filter fotoffice test`, `pnpm --filter muestras test`, `pnpm --filter infospot test:muestras-sync`, check-types de las cuatro.
- [ ] Portal en `next dev --webpack` con un socio de SFPR.
- [ ] PR, CI verde, fusionar (squash), esperar deploys.
- [ ] `curl https://muestrasfotograficas.com/api/public/actividades` → 16 ítems sin datos privados.
- [ ] Cron InfoSpot con `dryRun=1`, después real; ver las muestras en infospot.
