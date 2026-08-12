# DNX Partners — Activación destacada de sponsor

**Etapa:** Sponsor Global / Etapa 04 (FotoRank CONTEST)  
**Estado:** `FOTORANK_CONTEST_WELCOME` montado en landing pública de concurso; **flag OFF por defecto** (sin deploy / sin Vercel).

## Qué es

Una **activación destacada** es un interstitial controlado (`WELCOME_INTERSTITIAL`) que muestra una pieza aprobada de un sponsor al entrar a una **superficie expresamente autorizada** (placement). Reutiliza campañas, creatives, assets, outbound `/r/` e impresiones de DNX Partners.

## Arquitectura pública FotoRank (Etapa 04)

| Campo | Valor |
|-------|--------|
| Ruta real | `/concursos/[slug]` → `apps/fotorank/app/concursos/[slug]/page.tsx` |
| Landing vigente | **`contest-public`** (`ContestPublicLanding` + `getPublicContestLandingBySlug`) |
| `public-ui` | No presente en esta rama de trabajo; no se migró ni se montó allí |
| Visibilidad | Solo concursos `visibility=PUBLIC` + status `PUBLISHED\|ACTIVE` |
| ID canónico | `data.contest.id` (nunca slug como FK) |

Estados de inscripción / carga / jurado / resultados **no** bloquean la activación si la landing sigue pública.

## Superficie integrada — FotoRank CONTEST (Etapa 04)

| Campo | Valor |
|-------|--------|
| Placement | `FOTORANK_CONTEST_WELCOME` |
| Página | `apps/fotorank/app/concursos/[slug]/page.tsx` |
| Loader | `loadFotorankContestWelcomeAd` (server-only) |
| Wrapper cliente | `FotorankContestPartnerWelcome` |
| Flag | `FOTORANK_PARTNER_WELCOME_ENABLED` (default OFF) |
| Delay apertura | **1000 ms** (igual Clickatón) |
| Frecuencia | 24 h local (`campaignId` + placement) |
| Animación | `random` (reduced-motion → fade) |
| Tracking clic | `apps/fotorank/app/r/[trackingKey]/route.ts` |
| Impresión | `apps/fotorank/app/api/public/partners/impression` (`application: FOTO_RANK`) |

**No montado:** `FOTORANK_HOME_WELCOME` (portada general).

### Contexto de concurso

Sin migraciones. Se usa `DnxPartnerCampaign.participationId` → `DnxPartnerParticipation` vía filtro reutilizable (`isPartnerCampaignEligibleForScopeContext` / `isPartnerCampaignEligibleForContestContext`):

| Participación | Resultado |
|---------------|-----------|
| `null` | **No** se trata como global (evita campañas huérfanas) |
| `contextType=CONTEST` + `contextId=contestId` + `ACTIVE` + visible | Solo ese concurso |
| Otro concurso | **No** |
| `GLOBAL` / `PLATFORM` explícito + `ACTIVE` | Visible (global deliberado) |
| `HIDDEN` / no-ACTIVE / vencida / archivada | **No** |
| Otra app (Clickatón, CLF, InfoSpot, FotoOffice) | **No** |

`contestContextId` en `loadPartnerAdsForPlacement`. Compat: `editionContextId` + null-as-global se mantienen para Clickatón.

### Consultas (rendimiento)

| Flag | Comportamiento |
|------|----------------|
| OFF | Early return en loader app + kill-switch en ads-loader → **0** Prisma partners |
| ON | Hasta 1 lectura de placement + 1 `findMany` de bindings (máx. 1 creative) |

### Convivencia institucional

`ContestPartnersSection` / `partnerGroups={[]}` **intactos**. La activación DNX es independiente; **no** se habilita la sección estática de sponsors en esta etapa.

### Cómo validar localmente (sin prod / sin SFEF real)

1. Fixture sintético: campaña `ACTIVE`, placement `FOTORANK_CONTEST_WELCOME`, creative `APPROVED`, partner `ACTIVE`.
2. Participación `CONTEST` con `contextId` = ID del concurso de prueba, o `GLOBAL`/`PLATFORM` explícito.
3. Shell local: `FOTORANK_PARTNER_WELCOME_ENABLED=true` (nunca en Vercel en esta etapa).
4. Abrir `/concursos/<slug>` público → tras ~1s el interstitial (si frequency lo permite).
5. Sin flag: la página no consulta partners.

## Superficie previa — Clickatón EVENT (Etapa 03)

| Campo | Valor |
|-------|--------|
| Placement | `CLICKATON_EVENT_WELCOME` |
| Página | `apps/clickaton/app/(public)/maratones/[slug]/page.tsx` |
| Flag | `CLICKATON_PARTNER_WELCOME_ENABLED` (default OFF) |
| Delay | 1000 ms |
| Contexto | `editionContextId`; **null participation = global** (compat E3) |

`MarathonSponsors` legacy intacto.

## Plataformas / placements

| App enum | Welcome placements | Montaje público |
|----------|-------------------|-----------------|
| `CLICKATON` | `CLICKATON_HOME_WELCOME`, `CLICKATON_EVENT_WELCOME` | Solo **EVENT** (E03) |
| `FOTO_RANK` | `FOTORANK_HOME_WELCOME`, `FOTORANK_CONTEST_WELCOME` | Solo **CONTEST** (E04) |
| `INFO_SPOT` | `INFOSPOT_HOME_WELCOME` | Existente (flag ads) |
| `COMPRAME_LA_FOTO` | `CLF_HOME_WELCOME`, `CLF_ALBUM_WELCOME` | Pendiente |

## Exclusión de FotoOffice

- `WELCOME_ACTIVATION_EXCLUDED_APPLICATIONS = ["FOTO_OFFICE"]`.
- Sin placements FO; publish / admin / mount rechazan FO.

## Frecuencia local

- Clave: `dnx_partner_welcome_v1:{campaignId}:{placementKey}`.
- Marca al **abrir** (no al cerrar).
- Sin cookies / fingerprint / PII.

## Tracking

| Evento | Estado |
|--------|--------|
| Impresión | `PartnerViewableImpression` al abrir (viewability) → POST impression app |
| Clic | `/r/[trackingKey]` + nueva pestaña + `noopener noreferrer` |
| Cierre | Callback tipado — **sin persistencia DB** |

## Flags

| Flag | Default | Notas |
|------|---------|-------|
| `CLICKATON_PARTNER_WELCOME_ENABLED` | OFF | Truthy solo `1\|true\|on\|yes` |
| `FOTORANK_PARTNER_WELCOME_ENABLED` | OFF | Montado CONTEST; apagado |
| `INFOSPOT_PARTNER_ADS_ENABLED` | OFF | InfoSpot |
| `CLF_PARTNER_ADS_ENABLED` | OFF | CLF |

## Rutas excluidas (FotoRank)

Allowlist del placement: solo `/concursos/:slug`. Bloqueado: inscripción, carga, reemplazo, dashboard, jurado, auth, APIs, home (`/`), etc. vía `canMountPartnerWelcomeActivation`.

## Limitaciones conocidas

- Home FotoRank / Home Clickatón / CLF no montados.
- Cierre no persistido centralmente.
- Frequency solo por dispositivo/navegador.
- Campañas sin participación no son globales en FotoRank (sí en Clickatón por compat).
- Desempate: prioridad del loader (`placementPriority` → `campaignPriority` → `sortOrder`).
- No se crearon campañas productivas ni se tocó Santa Fe en Foco.

## Código de referencia

| Pieza | Ruta |
|-------|------|
| Contratos welcome | `packages/partners/src/welcome-activation.ts` |
| Contexto scope/edition/contest | `packages/partners/src/campaign-edition-context.ts` |
| Ads loader | `packages/db/src/partners-ads-loader.ts` |
| Interstitial | `packages/design-system/.../PartnerWelcomeInterstitial.tsx` |
| Clickatón server | `apps/clickaton/lib/public/partners-event-welcome.ts` |
| Clickatón client | `apps/clickaton/components/marathon/ClickatonEventPartnerWelcome.tsx` |
| FotoRank server | `apps/fotorank/app/lib/fotorank/partners/contest-welcome.ts` |
| FotoRank client | `apps/fotorank/app/components/contest-public/FotorankContestPartnerWelcome.tsx` |

## Próxima etapa prevista

Etapa 5 (propuesta, **sin iniciar**): montar welcome en ComprameLaFoto (`CLF_HOME_WELCOME` / `CLF_ALBUM_WELCOME`) bajo flag dedicado, sin tocar producción.
