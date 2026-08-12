# DNX Partners — Activación destacada de sponsor

**Etapa:** Sponsor Global / Etapa 02 (infraestructura compartida)  
**Estado:** preparado en catálogo + DS; **no montado** en Clickatón / FotoRank / CLF en esta etapa.

## Qué es

Una **activación destacada** es un interstitial controlado (`WELCOME_INTERSTITIAL`) que muestra una pieza aprobada de un sponsor al entrar a una **superficie expresamente autorizada** (placement). No es un sistema de ads paralelo: reutiliza campañas, creatives, assets, outbound `/r/` e impresiones de DNX Partners.

## Plataformas admitidas

| App enum | Welcome placements |
|----------|-------------------|
| `CLICKATON` | `CLICKATON_HOME_WELCOME`, `CLICKATON_EVENT_WELCOME` |
| `FOTO_RANK` | `FOTORANK_HOME_WELCOME`, `FOTORANK_CONTEST_WELCOME` |
| `INFO_SPOT` | `INFOSPOT_HOME_WELCOME` (existente; clave estable) |
| `COMPRAME_LA_FOTO` | `CLF_HOME_WELCOME`, `CLF_ALBUM_WELCOME` |

## Exclusión de FotoOffice

- El enum `FOTO_OFFICE` **permanece** por compatibilidad histórica.
- `WELCOME_ACTIVATION_EXCLUDED_APPLICATIONS = ["FOTO_OFFICE"]`.
- No hay placements de FotoOffice en el catálogo.
- `assertWelcomeActivationTargetAllowed` / `canMountPartnerWelcomeActivation` rechazan FO.
- Publicación multi-DB no incluye FO (`resolvePublicationDatabaseKey` → `null`).
- El selector admin de placements usa `listAdPlacementCatalogForAdminBinding()` (sin FO).

## Frecuencia local

- First-party `localStorage` (cliente).
- Default: **1 aparición / 24 h** por `campaña + placement`.
- Clave: `dnx_partner_welcome_v1:{campaignId}:{placementKey}`.
- Compat lectura: clave legacy `dnx_partner_welcome_{campaignId}` (InfoSpot).
- Se marca al **abrir** (visualización efectiva), no al cerrar.
- Sin cookies, sin fingerprint, sin PII.
- Utilidad: `@repo/design-system` → `welcome-frequency`.

## Animaciones

Variantes: `fade`, `slide-left`, `slide-right`, `slide-up`, y `random` (elige una sola vez por apertura).  
Con `prefers-reduced-motion: reduce` → fade mínimo / casi inmediato (sin slides).

## Accesibilidad

`PartnerWelcomeInterstitial`:

- `role="dialog"`, `aria-modal`, nombre accesible
- Cierre con **X** (hit ≥44px) y **Escape**
- Focus inicial en cerrar; restauración del foco al salir
- Tab cycle dentro del panel
- Scroll lock mientras está abierto
- Etiqueta visible «Contenido patrocinado»
- Safe areas móviles; tarjeta ≤ ~28rem / 85dvh (no full-bleed)

## Tracking

| Evento | Estado |
|--------|--------|
| Impresión (viewability) | Existente (`PartnerViewableImpression`) |
| Clic | Existente (`/r/[trackingKey]`, nueva pestaña + `noopener noreferrer`) |
| Cierre | Callback tipado `PARTNER_WELCOME_DISMISS` — **sin tabla / migración** en esta etapa |

## Flujos críticos

Helper `canMountPartnerWelcomeActivation({ application, placementKey, pathname })`:

1. Allowlist de **placements welcome** + rutas por placement.
2. Denylist adicional de **rutas críticas** (inscripción, checkout, admin, auth, upload, etc.).

Las apps deben llamar este gate **antes** de montar. Esta etapa no monta en CK/FR/CLF.

## Flags

| Flag | Default | Notas |
|------|---------|-------|
| `INFOSPOT_PARTNER_ADS_ENABLED` | OFF | Controla ads InfoSpot (incl. welcome) |
| `CLF_PARTNER_ADS_ENABLED` | OFF | Ads CLF |
| `CLICKATON_PARTNERS_PUBLIC_ENABLED` | ON (opt-out) | Público institucional (no welcome) |
| `CLICKATON_PARTNER_WELCOME_ENABLED` | OFF | Soporte código; **no cargar en Vercel aún** |
| `FOTORANK_PARTNER_WELCOME_ENABLED` | OFF | Idem |

## Limitaciones actuales

- Welcome **no montado** en Clickatón, FotoRank ni CLF (solo infra + InfoSpot existente).
- Cierre no se persiste en DB.
- Frequency solo local por dispositivo/navegador.
- Legacy `MarathonSponsors` y `OrganizerLandingSponsor` intactos.
- Admin CRM sigue en Clickatón.

## Código de referencia

| Pieza | Ruta |
|-------|------|
| Catálogo / flags | `packages/partners/src/campaigns.ts` |
| Contratos welcome | `packages/partners/src/welcome-activation.ts` |
| Interstitial | `packages/design-system/.../PartnerWelcomeInterstitial.tsx` |
| Frequency | `packages/design-system/.../welcome-frequency.ts` |
| InfoSpot wrapper | `apps/infospot/components/partners/PartnerAdsWelcome.tsx` |

## Próximas etapas (no iniciadas)

1. Montar welcome en superficies allowlisted (CK / FR / CLF) bajo flags.
2. Evaluar persistencia de cierres (migración dedicada si se aprueba).
3. Cutover gradual de sponsors legacy Clickatón.
