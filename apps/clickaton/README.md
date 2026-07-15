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

Integración HTTP opcional hacia FotoRank Public API V1 (listado/ficha). Default: fixtures. Sin autenticación, pagos ni inscripción en Clickaton.

## Desarrollo

```sh
# Desde la raíz del monorepo
pnpm install
pnpm --filter clickaton dev
```

App en [http://localhost:3005](http://localhost:3005).  
Producción: [https://maratonfotografica.com](https://maratonfotografica.com) (proyecto Vercel `clickaton-dnxsuite`).  
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
| `FOTORANK_PUBLIC_API_BASE_URL` | URL base de FotoRank (`http`/`https`, sin credenciales) | requerida si `fotorank` |

Con `fotorank`, Clickaton hace fetch server-to-server a `/api/public/v1/events`. Contests V1 no se publican como maratones oficiales (ver docs). No hay CORS de navegador.
## Arquitectura

```
apps/clickaton/
  app/
    maratones/         # Catálogo + [slug] ficha
    design-system/     # Catálogo interno (noindex)
    layout.tsx / page.tsx / error / not-found / robots
  components/
    brand/             # Wordmark, Viewfinder, graphics
    layout/            # Container, Section, Header, Footer
    ui/                # Button, Badge, Card, …
    home/              # Secciones de la Home
    content/           # PageHero, breadcrumbs, etc.
    marathon/          # Ficha pública de edición
  lib/                 # cn, seo, challenges, helpers de presentación
  data/public-marathons/ # servicio + fuente local intercambiable
  types/marathon.ts    # Contrato público estructural
  types/public/        # Contratos satélite
  content/             # Copy editorial + fixtures/
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

## Alcance

Incluye: app, Home, DS, rutas públicas, ficha demo, contrato tipado, adaptador FotoRank HTTP (opcional), docs.

No incluye: auth, DB propia, pagos, tienda, merchandising, formularios, Storybook.

## Pendientes

Ver [`docs/clickaton/BACKLOG.md`](../../docs/clickaton/BACKLOG.md).
