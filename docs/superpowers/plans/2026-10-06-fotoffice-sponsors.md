# FOTOFFICE Sponsors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada institución de FOTOFFICE administre sus sponsors sobre DNX Partners y los ubique en cuatro espacios de su sitio y su portal.

**Architecture:** Un cliente Prisma de escritura hacia la base de Clickatón, limitado a los modelos `dnxPartner*`, más un repositorio de FOTOFFICE (`lib/sponsors/`) que filtra todo por workspace. La lógica de cupos, fechas y vigencia es pura y probada; las pantallas son componentes de servidor con acciones de servidor, como Sorteos.

**Tech Stack:** Next.js (App Router, versión del repo — leer `node_modules/next/dist/docs/` ante dudas), Prisma 6, vitest, `@aws-sdk/client-s3` + `sharp` para logos, `@repo/partners` para el catálogo de espacios.

**Spec:** `docs/superpowers/specs/2026-10-06-fotoffice-sponsors-design.md`

## Global Constraints

- Sin migraciones: todas las columnas existen en la base de Clickatón (`ep-silent-haze-awfh50a5`, proyecto `bitter-math-56019731`), verificado el 06/10.
- La conexión de escritura NUNCA puede apuntar a la base de FOTOFFICE/FotoRank (`ep-dawn-dew-adyr8f1v`) ni a la de CompraMeLaFoto (`ep-falling-darkness-aduwh0tq`).
- Sin variable de escritura, FOTOFFICE no escribe en su base propia: modo lectura con aviso.
- Fechas de usuario en hora argentina (`America/Argentina/Buenos_Aires`); un día "hasta" incluye ese día entero.
- Logos: PNG, JPG o WebP, ≤ 5 MB, clave `clickaton/partners/logos/AAAA-MM-DD/<uuid>.<ext>` en `clickaton-media`.
- Textos de la interfaz en español rioplatense, sin tecnicismos.
- El build de FOTOFFICE chequea tipos incluidos los tests: correr `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit -p tsconfig.json` y `pnpm --filter fotoffice build`.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `packages/db/src/clickaton-partners-client.ts` (+ export en `package.json`) | Cliente de escritura acotado a `dnxPartner*`, con bloqueo de hosts |
| `packages/db/src/clickaton-partners-client.test.ts` | Pruebas del proxy y del bloqueo |
| `apps/fotoffice/lib/sponsors/constants.ts` | `SPONSORS_MODULE_KEY`, espacios de la entrega y sus rótulos |
| `apps/fotoffice/lib/sponsors/slots.ts` (+ test) | Puros: rango de fechas AR, primer lugar libre, vigencia |
| `apps/fotoffice/lib/sponsors/clients.ts` | Elige cliente de lectura y de escritura |
| `apps/fotoffice/lib/sponsors/repository.ts` | Consultas y escrituras filtradas por workspace |
| `apps/fotoffice/lib/sponsors/logo-storage.ts` (+ test) | Validación y subida del logo a `clickaton-media` |
| `apps/fotoffice/lib/sponsors/access.ts` | Guardas VIEW/MANAGE del módulo |
| `apps/fotoffice/lib/sponsors/placements.ts` | Lectura de lo vigente por espacio, para el sitio y el portal |
| `apps/fotoffice/app/(shell)/sponsors/**` | Lista, alta/vínculo y ficha con espacios; acciones |
| `apps/fotoffice/components/sponsors/**` | Franja de logos, sección del portal, ventana de bienvenida |
| Modificados | `lib/modules/registry.ts`, `lib/modules/submodules.ts`, `components/shell/shell-nav.tsx`, `components/shell/nav-icons.ts`, `app/api/sorteos/logo/[assetId]/route.ts`, `lib/raffles/repository.ts`, `app/(shell)/sorteos/actions.ts`, `app/portal/layout.tsx`, `app/portal/page.tsx`, `app/w/[workspaceSlug]/page.tsx`, `packages/partners/src/inventory.ts` |

## Task 1: Cliente de escritura acotado

**Files:** Create `packages/db/src/clickaton-partners-client.ts`, `packages/db/src/clickaton-partners-client.test.ts`; Modify `packages/db/package.json` (exports).

**Produces:** `getClickatonPartnersConnectionInfo(): { configured: boolean; hostMasked: string | null; reason?: string }`, `getClickatonPartnersPrisma(): PrismaClient | null`, `scopeToPartnerModels(client)` (exportado para probar).

- [ ] Test: el proxy deja `dnxPartner`, `dnxPartnerParticipation`, `dnxPartnerAsset`, `dnxPartnerInventoryBooking`; tira con `member`, `$executeRaw`, `$queryRawUnsafe`; permite `$transaction` con callback y le pasa un cliente también acotado.
- [ ] Test: `getClickatonPartnersConnectionInfo` con URL a `ep-dawn-dew-adyr8f1v` → `configured: false`.
- [ ] Implementar copiando el molde de `clickaton-jury-client.ts` (singleton en `globalThis`, `maskHost`), variable `CLICKATON_PARTNERS_DATABASE_URL`.
- [ ] Correr `pnpm --filter @repo/db exec vitest run src/clickaton-partners-client.test.ts`; commit.

## Task 2: Lógica pura de espacios

**Files:** Create `apps/fotoffice/lib/sponsors/constants.ts`, `slots.ts`, `slots.test.ts`.

**Produces:**
```ts
export const SPONSORS_MODULE_KEY = "sponsors";
export const FOTOFFICE_SPONSOR_PLACEMENTS = ["FOTOFFICE_PUBLIC_MARQUEE","FOTOFFICE_PORTAL_SPONSORS","FOTOFFICE_PORTAL_WELCOME","FOTOFFICE_PORTAL_MARQUEE"] as const;
export type SponsorPlacementKey = (typeof FOTOFFICE_SPONSOR_PLACEMENTS)[number];
export function placementLabel(key: SponsorPlacementKey): string;
export function placementCapacity(key: SponsorPlacementKey): number; // de AD_PLACEMENT_CATALOG.maxItems
export function rangoArgentino(desde: string, hasta: string): { startsAt: Date; endsAt: Date } | { error: string };
export function primerLugarLibre(ocupados: { slotIndex: number; startsAt: Date; endsAt: Date }[], rango: { startsAt: Date; endsAt: Date }, capacidad: number): number | null;
export function estaVigente(b: { startsAt: Date; endsAt: Date }, ahora: Date): boolean;
```
- [ ] Tests: `rangoArgentino("2026-10-06","2026-10-06")` → `2026-10-06T03:00Z`..`2026-10-07T03:00Z`; hasta < desde → error; formato inválido → error. `primerLugarLibre` salta los lugares que se superponen, devuelve `null` lleno, ignora los que no se superponen (`[)`). `estaVigente` en bordes.
- [ ] Implementar, correr `pnpm --filter fotoffice exec vitest run lib/sponsors/slots.test.ts`, commit.

## Task 3: Repositorio y logo

**Files:** Create `lib/sponsors/clients.ts`, `repository.ts`, `logo-storage.ts`, `logo-storage.test.ts`, `placements.ts`; Modify `app/api/sorteos/logo/[assetId]/route.ts` (aceptar `clickaton/partners/logos/AAAA-MM-DD/x.ext`).

**Produces (repository):**
```ts
listWorkspaceSponsors(workspaceId): Promise<SponsorRow[]>
searchCatalog(workspaceId, texto): Promise<{ id; name; logoSrc; linked: boolean }[]>
getWorkspaceSponsor(workspaceId, partnerId): Promise<SponsorDetail | null>
linkSponsor({ workspaceId, partnerId, userId }): Promise<void>   // idempotente
createSponsor({ workspaceId, name, websiteUrl, instagram, userId }): Promise<string>
updateSponsorCommon(workspaceId, partnerId, { name, websiteUrl, instagram }): Promise<void>
updateSponsorLocal(workspaceId, partnerId, { title, description, destinationUrl, notes }): Promise<void>
unlinkSponsor(workspaceId, partnerId): Promise<void> // ARCHIVED + cancela asignaciones futuras
assignPlacement({ workspaceId, partnerId, placementKey, desde, hasta, userId }): Promise<{ ok: true } | { ok: false; error: string }>
cancelPlacement(workspaceId, bookingId): Promise<void>
saveSponsorLogo({ workspaceId, partnerId, file, userId }): Promise<{ ok: true } | { ok: false; error: string }>
```
`placements.ts`: `loadActivePlacement(workspaceId, key, ahora?)` → `PlacedSponsor[]` (`{ partnerId, name, logoSrc, href, title, description }`), nunca lanza.

- [ ] Test de `logo-storage`: validación de tipo/tamaño y forma de la clave.
- [ ] Implementar; toda escritura verifica antes que el sponsor tenga participación del workspace (salvo `linkSponsor`/`createSponsor`). `assignPlacement` reintenta el siguiente lugar si Postgres rechaza por la restricción de exclusión (código `23P01`).
- [ ] Commit.

## Task 4: Módulo en el panel

**Files:** Create `lib/sponsors/access.ts`, `app/(shell)/sponsors/page.tsx`, `nuevo/page.tsx`, `nuevo/buscador.tsx`, `[partnerId]/page.tsx`, `actions.ts`; Modify registry, submodules, shell-nav, nav-icons.

- [ ] Registrar `sponsors` (INSTITUTIONAL, order 116, route `/sponsors`), submódulo con icono `Handshake`, sección "Sponsors" en el menú tras Sorteos.
- [ ] Lista, alta con buscador (cliente) y creación, ficha con datos comunes/propios, logo, espacios (alta y baja) y desvincular. Aviso de modo lectura si falta la conexión.
- [ ] Commit.

## Task 5: Buscador de premios

**Files:** Modify `lib/raffles/repository.ts` (`searchPartners(workspaceId, texto)` vía `searchCatalog`, email sólo si está vinculado), `app/(shell)/sorteos/actions-partners.ts`, `app/(shell)/sorteos/actions.ts` (al guardar premio con `partnerId`, `linkSponsor` best effort).
- [ ] Commit.

## Task 6: Espacios públicos

**Files:** Create `components/sponsors/logo-marquee.tsx`, `portal-sponsors-section.tsx`, `portal-welcome.tsx`; Modify `app/w/[workspaceSlug]/page.tsx`, `app/portal/layout.tsx`, `app/portal/page.tsx`, `packages/partners/src/inventory.ts` (`mounted: true` en los 4).
- [ ] Sólo si el módulo `sponsors` está encendido para el workspace.
- [ ] Commit.

## Task 7: Vincular los aliados de los sorteos y verificar

**Files:** Create `apps/fotoffice/scripts/vincular-aliados-de-sorteos.ts` (idempotente, `--aplicar`).
- [ ] tsc con memoria extra, vitest, `pnpm --filter fotoffice build`.
- [ ] PR, fusionar, esperar Ready en Vercel, encender el módulo en SFPR, correr el script, probar en producción.
