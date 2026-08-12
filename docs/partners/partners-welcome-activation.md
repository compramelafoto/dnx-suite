# DNX Partners — Activación destacada de sponsor

**Etapa:** Sponsor Global / Etapa 05 (ComprameLaFoto ALBUM)  
**Estado:** `CLF_ALBUM_WELCOME` montado en álbum público; **flags OFF por defecto** (sin deploy / sin Vercel).

## Qué es

Una **activación destacada** es un interstitial controlado (`WELCOME_INTERSTITIAL`) que muestra una pieza aprobada de un sponsor al entrar a una **superficie expresamente autorizada** (placement). Reutiliza campañas, creatives, assets, outbound `/r/` e impresiones de DNX Partners.

## Arquitectura pública CLF — álbum (Etapa 05)

| Campo | Valor |
|-------|--------|
| Ruta canónica | `/album/[slug]` → `apps/compramelafoto/app/album/[slug]/page.tsx` |
| Legacy | `/a/[id]` → 301 a `/album/[slug]` (no montar welcome ahí) |
| No equivalentes | `/e/[shareSlug]` (evento), `/g/[shareSlug]` (galería agregada) |
| Modelo | `Album` — ID canónico `Album.id` (Int → string en contexto) |
| Visibilidad | `isPublic && !isHidden`, no `deletedAt`, no test, no `isAccessBlocked` |
| Password | No existe; invitaciones / unlisted / hidden grants son otros flujos |

Ventas cerradas **no** bloquean si el álbum sigue públicamente visible.

## Superficie integrada — CLF ALBUM (Etapa 05)

| Campo | Valor |
|-------|--------|
| Placement | `CLF_ALBUM_WELCOME` |
| Página | `apps/compramelafoto/app/album/[slug]/page.tsx` |
| Loader | `loadClfAlbumWelcomeAd` (server-only) |
| Wrapper cliente | `ClfAlbumPartnerWelcome` |
| Flags (ambos requeridos) | `CLF_PARTNER_ADS_ENABLED` **y** `CLF_PARTNER_ALBUM_WELCOME_ENABLED` (default OFF) |
| Delay | **1000 ms** |
| Frecuencia | 24 h local |
| Tracking clic | `apps/compramelafoto/app/r/[trackingKey]/route.ts` |
| Impresión | `apps/compramelafoto/app/api/public/partners/impression` |

**No montado:** `CLF_HOME_WELCOME`.

### Contexto de álbum

Sin migraciones. Participación `DnxPartnerParticipation`:

| Participación | Resultado |
|---------------|-----------|
| `null` | **No** global (evita huérfanas) |
| `ALBUM` + `contextId=String(album.id)` + `ACTIVE` | Solo ese álbum |
| Otro álbum | **No** |
| `GLOBAL` / `PLATFORM` explícito + `ACTIVE` | Sí |
| Otra app | **No** |

### Convivencia `OrganizerLandingSponsor`

Sistema **paralelo** de la landing del organizador (`/[handler]`). **No** se migra, fusiona ni convierte en campañas DNX. La galería del álbum no renderiza `OrganizerLandingSponsor`.

### Cómo validar localmente

1. Fixture: campaña `ACTIVE`, placement `CLF_ALBUM_WELCOME`, creative `APPROVED`, partner `ACTIVE`.
2. Participación `ALBUM` con `contextId` = id del álbum, o `GLOBAL`/`PLATFORM`.
3. Local: `CLF_PARTNER_ADS_ENABLED=true` y `CLF_PARTNER_ALBUM_WELCOME_ENABLED=true`.
4. Abrir `/album/<slug>` público → ~1s interstitial.
5. Cualquier flag OFF: cero consultas partners para welcome.

## Superficies previas

| Etapa | Placement | App |
|-------|-----------|-----|
| 03 | `CLICKATON_EVENT_WELCOME` | Clickatón `/maratones/[slug]` |
| 04 | `FOTORANK_CONTEST_WELCOME` | FotoRank `/concursos/[slug]` (`contest-public`) |
| — | `INFOSPOT_HOME_WELCOME` | InfoSpot (flag ads) |

## Plataformas / placements

| App | Welcome placements | Montaje |
|-----|-------------------|---------|
| `CLICKATON` | HOME, EVENT | Solo EVENT |
| `FOTO_RANK` | HOME, CONTEST | Solo CONTEST |
| `COMPRAME_LA_FOTO` | HOME, ALBUM | Solo **ALBUM** (E05) |
| `INFO_SPOT` | HOME | Existente |

## Exclusión FotoOffice

Sin cambios: FO excluido del catálogo welcome / mount / publish.

## Flags

| Flag | Default | Notas |
|------|---------|-------|
| `CLICKATON_PARTNER_WELCOME_ENABLED` | OFF | |
| `FOTORANK_PARTNER_WELCOME_ENABLED` | OFF | |
| `CLF_PARTNER_ADS_ENABLED` | OFF | Kill switch ads CLF |
| `CLF_PARTNER_ALBUM_WELCOME_ENABLED` | OFF | Welcome álbum; requiere también ads |
| `INFOSPOT_PARTNER_ADS_ENABLED` | OFF | |

## Limitaciones

- Home CLF / Home CK / Home FR no montados.
- Unlisted/privado/oculto/test/bloqueado: sin welcome.
- Cierre no persistido centralmente.
- Frequency por dispositivo/navegador.

## Código de referencia

| Pieza | Ruta |
|-------|------|
| Contexto scope/album | `packages/partners/src/campaign-edition-context.ts` |
| Ads loader | `packages/db/src/partners-ads-loader.ts` |
| CLF server | `apps/compramelafoto/lib/public/partners-album-welcome.ts` |
| CLF client | `apps/compramelafoto/components/partners/ClfAlbumPartnerWelcome.tsx` |

## Próxima etapa prevista

Etapa 6 (propuesta, **sin iniciar**): elegir entre `CLF_HOME_WELCOME` o administración/prueba controlada de campañas (staging, flags locales, fixtures), sin producción.
