# Clickaton

Aplicación pública de **Clickaton** (Maratón Fotográfica Internacional) dentro del monorepo **DNX Suite**.

## Propósito

Experiencia digital de marca pública. Etapa 01: Home fundacional. Etapa 02: Sistema de Diseño MVP aplicado a la Home.

## Relación Clickaton ↔ FotoRank

| Rol | Responsabilidad |
|-----|-----------------|
| **Clickaton** | Marca pública y experiencia de comunicación |
| **FotoRank** | Motor tecnológico (eventos, inscripciones, pagos, consignas, GPS/EXIF, jurados, rankings, resultados) |

Sin integración con FotoRank todavía. Sin autenticación, base de datos, pagos ni catálogo.

## Desarrollo

```sh
# Desde la raíz del monorepo
pnpm install
pnpm --filter clickaton dev
```

App en [http://localhost:3005](http://localhost:3005).  
Producción: [https://maratonfotografica.com](https://maratonfotografica.com) (proyecto Vercel `clickaton-dnxsuite`).  
Catálogo interno DS: [http://localhost:3005/design-system](http://localhost:3005/design-system) (`noindex`).

```sh
pnpm --filter clickaton lint
pnpm --filter clickaton check-types
pnpm --filter clickaton build
```

No requiere variables de entorno para la Home.

## Arquitectura

```
apps/clickaton/
  app/
    design-system/     # Catálogo interno (noindex)
    layout.tsx / page.tsx / error / not-found / robots
  components/
    brand/             # Wordmark, Viewfinder, graphics
    layout/            # Container, Section, Header, Footer
    ui/                # Button, Badge, Card, …
    home/              # Secciones de la Home
  lib/cn.ts
  styles/tokens.css + utilities.css
  config/ + content/
  public/brand/        # Futuros logos oficiales
```

## Sistema de Diseño MVP

- Tokens semánticos + tipografía fluida
- Primitives: `Container`, `Section`, `SectionHeader`, `Stack`
- UI: `Button`, `Badge`, `Card`, `IconFrame`, `Divider`, `FocusMark`
- Recursos: `ViewfinderFrame`, `CoordinateGrid`, `EditorialLabel`, `BrushStroke`
- **Sin shadcn/ui** (no existe en el monorepo; componentes propios)

Doc: [`docs/clickaton/DESIGN_SYSTEM.md`](../../docs/clickaton/DESIGN_SYSTEM.md).

## Decisiones técnicas

1. Package `clickaton`, puerto `3005`.
2. Dominio: `https://maratonfotografica.com` (Vercel: `clickaton-dnxsuite`).
3. Tipografía: Barlow Condensed + DM Sans vía `next/font`.
4. Cliente solo en header (menú) y `error.tsx`.
5. `robots`: disallow / noindex hasta lanzamiento público.
6. Sin lucide ni Radix: iconografía mínima propia.

## Alcance

Incluye: app, Home migrada al DS, tokens, `/design-system`, docs.

No incluye: FotoRank, auth, DB, pagos, tienda, merchandising, formularios, Storybook.

## Pendientes

Ver [`docs/clickaton/BACKLOG.md`](../../docs/clickaton/BACKLOG.md).
