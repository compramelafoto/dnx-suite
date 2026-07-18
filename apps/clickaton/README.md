# Clickaton

Aplicación pública de **Clickaton** (Maratón Fotográfica Internacional) dentro del monorepo **DNX Suite**.

## Propósito

Experiencia digital de marca pública.

- Etapa 01: foundation
- Etapa 02: Design System MVP
- Etapa 03: Home de lanzamiento
- Etapa 04: arquitectura pública + modelo de maratón
- Etapa 05: ficha pública `/maratones/[slug]` + contrato FotoRank

## Relación Clickaton ↔ FotoRank

| Rol | Responsabilidad |
|-----|-----------------|
| **Clickaton** | Marca pública y experiencia de comunicación |
| **FotoRank** | Motor tecnológico (eventos, inscripciones, pagos, consignas, GPS/EXIF, jurados, rankings, resultados) |

Contrato: [`docs/clickaton/FOTORANK_INTEGRATION_CONTRACT.md`](../../docs/clickaton/FOTORANK_INTEGRATION_CONTRACT.md).  
Adaptador público: [`docs/clickaton/FOTORANK_PUBLIC_INTEGRATION.md`](../../docs/clickaton/FOTORANK_PUBLIC_INTEGRATION.md).

Integración HTTP opcional hacia FotoRank Public API V1 (listado/ficha). Default: fixtures. Sin autenticación, pagos ni carrito en Clickaton — el CTA deriva a FotoRank (`registrationUrl`). `checkoutUrl` permanece null hasta 09B2/DNX Payments.

Docs: [`docs/clickaton/REGISTRATION_HANDOFF.md`](../../docs/clickaton/REGISTRATION_HANDOFF.md). Cobro futuro: DNX Payments (09B2), no Preferences en FotoRank.

## Desarrollo

```sh
# Desde la raíz del monorepo
pnpm install
pnpm --filter clickaton dev
```

App en [http://localhost:3005](http://localhost:3005).  
Producción: [https://maratonfotografica.com](https://maratonfotografica.com) (proyecto Vercel `clickaton-dnxsuite`).  
Manual de marca (diseñadores / sedes): [http://localhost:3005/manualdemarca](http://localhost:3005/manualdemarca) · [https://maratonfotografica.com/manualdemarca](https://maratonfotografica.com/manualdemarca).  
Catálogo interno DS: [http://localhost:3005/design-system](http://localhost:3005/design-system) (`noindex`).  
Ficha demo: [http://localhost:3005/maratones/demo](http://localhost:3005/maratones/demo) (`noindex`).

```sh
pnpm --filter clickaton lint
pnpm --filter clickaton check-types
pnpm --filter clickaton build
```

### Variables de entorno

Ver [`.env.example`](./.env.example).

| Variable | Valores | Default |
|----------|---------|---------|
| `CLICKATON_PUBLIC_DATA_SOURCE` | `fixture` \| `fotorank` | `fixture` |
| `FOTORANK_PUBLIC_API_BASE_URL` | URL base API FotoRank (`http`/`https`) | requerida si `fotorank` |
| `FOTORANK_PUBLIC_WEB_BASE_URL` | URL web FotoRank (handoff; fallback API) | opcional |
| `CLICKATON_PUBLIC_WEB_BASE_URL` | Origen público Clickatón (`returnTo` / OAuth base) | opcional |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth DNX Suite (panel `/admin`) | requerido para login Google |

Panel admin: Google OAuth vía DNX Identity — [`docs/clickaton/GOOGLE_OAUTH_ADMIN.md`](../../docs/clickaton/GOOGLE_OAUTH_ADMIN.md).

Con `fotorank`, Clickaton hace fetch server-to-server a `/api/public/v1/events` y muestra `registration` (precio/CTA). Handoff: [REGISTRATION_HANDOFF.md](../../docs/clickaton/REGISTRATION_HANDOFF.md). Sin cobros en Clickaton.
## Arquitectura

```
apps/clickaton/
  app/
    (public)/          # Sitio público (header/footer)
    admin/             # Panel operativo (shell propio)
    layout.tsx / robots / not-found raíz
  components/
    brand/ layout/ ui/ home/ content/ marathon/
    admin/             # Shell, sidebar, empty states
  config/admin/        # Menú, admins, integraciones
  lib/admin/           # Auth guards server-side
  data/public-marathons/
  types/ … content/
```

## Design System V2

- Identidad editorial oscura (`#111` / `#1B1B1B` / `#2A2A2A`) — amarillo `#FFC400` solo como acento
- Tipografía: **Bebas Neue** (display) + **Montserrat** (UI) + Caveat (acento fino)
- Logo oficial vía `Logo` / `Wordmark` (chrome: `horizontalMono`)
- Primitives: `Container`, `Section`, `SectionHeader`, `Stack`
- UI: `Button`, `Badge`, `Card`, `IconFrame`, `Divider`, `FocusMark`, `Input`, `Select`, `Textarea`
- Recursos: `ViewfinderFrame`, `CoordinateGrid`, `EditorialLabel`, `BrushStroke`, grain/vignette
- **Sin shadcn/ui** — componentes propios

Doc: [`docs/clickaton/DESIGN_SYSTEM.md`](../../docs/clickaton/DESIGN_SYSTEM.md) · catálogo `/design-system`.

## Decisiones técnicas

1. Package `clickaton`, puerto `3005`.
2. Dominio: `https://maratonfotografica.com` (Vercel: `clickaton-dnxsuite`).
3. Tipografía: Bebas Neue + Montserrat (+ Caveat) vía `next/font`.
4. Cliente solo en header (menú) y `error.tsx`.
5. `robots`: disallow / noindex hasta lanzamiento público.
6. Sin lucide ni Radix: iconografía mínima propia.
7. Consignas filtradas en servidor antes de UI (`lib/challenges.ts`).

## Panel admin (Etapa 10B)

- Rutas: `/admin` (shell + menú MVP). Login: `/admin/login`.
- Separado del chrome público (`app/(public)` vs `app/admin`).
- Auth: cookie `dnx_session` + política centralizada de administradores (`config/admin/admins.ts`).
- Doc: [`docs/clickaton/ADMIN_PANEL.md`](../../docs/clickaton/ADMIN_PANEL.md).

```sh
pnpm --filter clickaton selfcheck:admin-auth
```

## Alcance

Incluye: app, Home, DS, rutas públicas, ficha demo, contrato tipado, adaptador FotoRank HTTP (opcional), panel admin shell, docs.

No incluye: CRUD de ediciones/sedes/inscripciones/sponsors, pagos, tienda, Storybook, DNX Communications.

## Pendientes

Ver [`docs/clickaton/BACKLOG.md`](../../docs/clickaton/BACKLOG.md).
