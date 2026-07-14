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

Sin integración real todavía. Sin autenticación, base de datos, pagos ni catálogo comercial.

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

No requiere variables de entorno para las páginas públicas actuales.

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

## Design System V1

- Fuente de verdad: Manual de Marca en `public/brand/`
- Tokens: `#FFC400` / negro / blanco + secundarios de estado
- Tipografía: **Bebas Neue** (display) + **Montserrat** (UI) + Caveat (acento)
- Logo oficial vía `Logo` / `Wordmark` (no wordmark tipográfico)
- Primitives: `Container`, `Section`, `SectionHeader`, `Stack`
- UI base: `Button`, `Badge`, `Card`, `IconFrame`, `Divider`, `FocusMark`
- Recursos: `ViewfinderFrame`, `CoordinateGrid`, `EditorialLabel`, `BrushStroke`
- **Sin shadcn/ui** — componentes propios

Doc: [`docs/clickaton/DESIGN_SYSTEM.md`](../../docs/clickaton/DESIGN_SYSTEM.md) · [`docs/clickaton/PUBLIC_ARCHITECTURE.md`](../../docs/clickaton/PUBLIC_ARCHITECTURE.md).

## Decisiones técnicas

1. Package `clickaton`, puerto `3005`.
2. Dominio: `https://maratonfotografica.com` (Vercel: `clickaton-dnxsuite`).
3. Tipografía: Bebas Neue + Montserrat (+ Caveat) vía `next/font`.
4. Cliente solo en header (menú) y `error.tsx`.
5. `robots`: disallow / noindex hasta lanzamiento público.
6. Sin lucide ni Radix: iconografía mínima propia.
7. Consignas filtradas en servidor antes de UI (`lib/challenges.ts`).

## Alcance

Incluye: app, Home, DS, rutas públicas, ficha demo, contrato tipado, docs.

No incluye: FotoRank API, auth, DB, pagos, tienda, merchandising, formularios, Storybook.

## Pendientes

Ver [`docs/clickaton/BACKLOG.md`](../../docs/clickaton/BACKLOG.md).
