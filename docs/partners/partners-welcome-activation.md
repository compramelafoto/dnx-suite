# DNX Partners — Activación destacada de sponsor

**Etapa:** Sponsor Global / Etapa 03 (Clickatón EVENT)  
**Estado:** `CLICKATON_EVENT_WELCOME` montado en landing pública de maratón; **flag OFF por defecto** (sin deploy / sin Vercel).

## Qué es

Una **activación destacada** es un interstitial controlado (`WELCOME_INTERSTITIAL`) que muestra una pieza aprobada de un sponsor al entrar a una **superficie expresamente autorizada** (placement). Reutiliza campañas, creatives, assets, outbound `/r/` e impresiones de DNX Partners.

## Primera superficie integrada (Etapa 03)

| Campo | Valor |
|-------|--------|
| Placement | `CLICKATON_EVENT_WELCOME` |
| Página | `apps/clickaton/app/(public)/maratones/[slug]/page.tsx` |
| Loader | `loadClickatonEventWelcomeAd` |
| Wrapper cliente | `ClickatonEventPartnerWelcome` |
| Flag | `CLICKATON_PARTNER_WELCOME_ENABLED` (default OFF) |
| Delay apertura | **1000 ms** |
| Frecuencia | 24 h local (`campaignId` + placement) |
| Animación | `random` (estable por apertura; reduced-motion → fade) |

### Contexto de edición

Sin migraciones. Se usa `DnxPartnerCampaign.participationId` → `DnxPartnerParticipation`:

| Participación | Resultado |
|---------------|-----------|
| `null` (campaña global) | Visible en cualquier landing de evento permitida |
| `contextType=EDITION\|EVENT` + `contextId=editionId` | Solo esa edición |
| Otra edición | **No** se muestra (sin fallback) |
| `GLOBAL` / `PLATFORM` | Visible |
| Otra app / CATEGORY / etc. | **No** |

`editionId` = `PublicMarathon.id` (= `ClickatonEdition.id` en fuente Prisma).

### Rutas excluidas (además del allowlist)

Inscripción, pago, checkout tienda, admin, auth, upload/entrega, `/r/`, etc. vía `canMountPartnerWelcomeActivation`.  
Allowlist del placement: solo `/maratones/:slug` (sin segmentos extra).

### Convivencia legacy

`MarathonSponsors` / `PublicMarathon.sponsors` **siguen intactos**. La activación DNX es independiente (no reemplaza logos estáticos).

### Cómo validar localmente (sin prod)

1. DB local/staging con campaña `ACTIVE`, placement `CLICKATON_EVENT_WELCOME`, creative `APPROVED`, partner `ACTIVE`.
2. Opcional: `participation` EDITION con `contextId` de la edición de prueba.
3. En shell local: `CLICKATON_PARTNER_WELCOME_ENABLED=true` (nunca en Vercel en esta etapa).
4. Abrir `/maratones/<slug>` → tras ~1s aparece el interstitial (si frequency lo permite).
5. Sin flag: la página no consulta partners (early return).

## Plataformas / placements

| App enum | Welcome placements | Montaje público |
|----------|-------------------|-----------------|
| `CLICKATON` | `CLICKATON_HOME_WELCOME`, `CLICKATON_EVENT_WELCOME` | Solo **EVENT** (Etapa 03) |
| `FOTO_RANK` | `FOTORANK_HOME_WELCOME`, `FOTORANK_CONTEST_WELCOME` | Pendiente |
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
| Impresión | `PartnerViewableImpression` al abrir (viewability) |
| Clic | `/r/[trackingKey]` + nueva pestaña + `noopener noreferrer` |
| Cierre | Callback tipado — **sin persistencia DB** |

## Flags

| Flag | Default | Notas |
|------|---------|-------|
| `CLICKATON_PARTNER_WELCOME_ENABLED` | OFF | Truthy solo `1\|true\|on\|yes` |
| `INFOSPOT_PARTNER_ADS_ENABLED` | OFF | InfoSpot |
| `CLF_PARTNER_ADS_ENABLED` | OFF | CLF |
| `FOTORANK_PARTNER_WELCOME_ENABLED` | OFF | Aún no montado |

## Limitaciones conocidas

- Home Clickatón (`CLICKATON_HOME_WELCOME`) no montado.
- FotoRank / CLF no montados.
- Cierre no persistido centralmente.
- Frequency solo por dispositivo/navegador.
- Desempate multi-campaña: prioridad del loader existente (`placementPriority` → `campaignPriority` → `sortOrder`); rotación del placement (STATIC/RANDOM) sin algoritmo comercial nuevo.
- Demos técnicas (`isDemo`) no reciben welcome.

## Código de referencia

| Pieza | Ruta |
|-------|------|
| Contratos welcome | `packages/partners/src/welcome-activation.ts` |
| Contexto edición | `packages/partners/src/campaign-edition-context.ts` |
| Ads loader | `packages/db/src/partners-ads-loader.ts` |
| Interstitial | `packages/design-system/.../PartnerWelcomeInterstitial.tsx` |
| Clickatón server | `apps/clickaton/lib/public/partners-event-welcome.ts` |
| Clickatón client | `apps/clickaton/components/marathon/ClickatonEventPartnerWelcome.tsx` |

## Próxima etapa prevista

Etapa 4: montar welcome en FotoRank (`FOTORANK_CONTEST_WELCOME` / home) bajo flag dedicado, sin tocar producción.
