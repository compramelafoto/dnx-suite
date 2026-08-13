# DNX Partners — Slider de marcas (`LOGO_MARQUEE`)

**Etapa 10** — infraestructura transversal. Sin montaje nuevo en Clickatón/FotoRank. Sin deploy. Sin migraciones.

## Definición

Franja continua de logos patrocinadores dentro de una superficie autorizada.

- **Formato técnico:** `LOGO_MARQUEE` (reutilizado; no crear enums nuevos).
- **Nombre admin:** Slider de marcas.
- **Componente canónico:** `PartnerLogoMarquee` (`@repo/design-system`).

## Diferencia con welcome

| | Welcome | Slider de marcas |
|--|---------|------------------|
| Formato | `WELCOME_INTERSTITIAL` | `LOGO_MARQUEE` |
| UI | Modal / interstitial | Franja inline |
| Cap | Frequency 24h | Varios logos simultáneos |
| Tracking | Viewable + `/r/` | Viewable por logo (copia canónica) |

## Modelo: una campaña por sponsor

Varias campañas elegibles pueden coincidir en el mismo placement.

Beneficios: analytics por marca, vigencia/prioridad/destino independientes, pausa individual, autorización por plataforma.

No implementar campañas multi-sponsor propietarias.

## Placements

| Placement | App | Estado | Publicable |
|-----------|-----|--------|------------|
| `INFOSPOT_HOME_MARQUEE` | InfoSpot | Montado | Sí |
| `CLF_LOGO_MARQUEE` | CLF | Montado | Sí |
| `CLICKATON_HOME_MARQUEE` | Clickatón | Preparado | No |
| `CLICKATON_EVENT_MARQUEE` | Clickatón | Preparado | No |
| `FOTORANK_HOME_MARQUEE` | FotoRank | Preparado | No |
| `FOTORANK_CONTEST_MARQUEE` | FotoRank | Preparado | No |

`CLF_LOGO_MARQUEE` se muestra en admin como «ComprameLaFoto — Portada — Slider de marcas». No crear `CLF_HOME_MARQUEE` duplicado.

Validación server-side: `assertLogoMarqueePlacementPublishable` rechaza placements no montados y FotoOffice.

## Assets

Solo `APPROVED`, del sponsor, URL segura, alt obligatorio, PNG/WebP/JPG (SVG solo si el pipeline sanitiza). No modificar assets/campaña Vicario.

## Accesibilidad (`PartnerLogoMarquee`)

- Región con nombre accesible.
- Lista semántica (`ul`/`li`).
- Pause en `:hover` y `:focus-within`.
- Foco visible en enlaces.
- `prefers-reduced-motion`: sin animación, oculta copias del loop, scroll horizontal si hace falta.
- 1–2 sponsors: fila estática centrada (sin loop agresivo).
- 3+: marquee continuo.
- Alt obligatorio o fallback `Logo de {name}`.

## Tracking / analytics

- Clic: `/r/[trackingKey]` cuando hay outbound.
- Impresión: viewable ≥50% ≥1s, solo copia canónica (`data-loop-copy=0`).
- **Gap:** sin outbound `/r/` el logo puede mostrarse (sin enlace falso) pero **no** se registra impresión con la arquitectura actual (`PartnerViewableImpression` exige tracking key en href). No se inventan eventos.

## Convivencia legacy

- **Clickatón:** `AlliesLogoMarquee` (marketing) y `MarathonSponsors` (legacy evento) conviven; DNX marquee futuro es capa comercial aparte.
- **FotoRank:** `ContestPartnersSection` institucional (hoy vacío) no se alimenta desde DNX en Etapa 10.
- **CLF:** `OrganizerSponsorsCarousel` / `OrganizerLandingSponsor` ≠ `CLF_LOGO_MARQUEE`.
- **InfoSpot:** comportamiento actual conservado.

## FotoOffice

Excluido de placements, selector, targets, publicación y preview. El enum histórico permanece por compatibilidad.

## Activación futura (no Etapa 10)

1. Montar runtime CK/FR.
2. Mover keys a `MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS`.
3. Activar flags/ads por app.
4. Publicar campañas explícitas (sin auto-cross-post).
5. No ejecutar `ensureAdPlacementCatalog` solo para “registrar” en Production sin montaje.

## Código

- Dominio: `packages/partners/src/marquee-admin.ts`
- Catálogo: `packages/partners/src/campaigns.ts`
- UI: `PartnerLogoMarquee.tsx`
- Doc admin: panel campañas Clickatón (copy + estados Disponible/Próximamente)
