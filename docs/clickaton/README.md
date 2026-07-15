# Clickaton — documentación

## Etapa 01 — Fundación técnica

Creación de `apps/clickaton` en DNX Suite: frontend público independiente, integrado al monorepo, sin lógica de negocio.

### Qué se entregó

- App Next.js en el workspace pnpm + Turbo
- Home fundacional responsive (amarillo / negro / blanco)
- Configuración central de marca y navegación MVP
- Tokens visuales base
- Tokens base (luego alineados a Manual en DS V1)
- Preparación de carpetas para assets oficiales
- `vercel.json` para despliegue independiente futuro

### Qué no se entregó (a propósito)

- Integración FotoRank
- Autenticación / DNX Identity
- Base de datos / Prisma
- Inscripciones, pagos, Mercado Pago
- Catálogo / merchandising / carrito
- Formularios persistentes / newsletter funcional
- Dominio de producción / OAuth

### Comandos

```sh
pnpm --filter clickaton dev
pnpm --filter clickaton lint
pnpm --filter clickaton check-types
pnpm --filter clickaton build
```

### Dominio y Vercel

- Dominio: [https://maratonfotografica.com](https://maratonfotografica.com)
- Proyecto: `clickaton-dnxsuite` (`rootDirectory`: `apps/clickaton`)
- `www.maratonfotografica.com` → redirect 308 al apex
- Indexación: todavía `noindex` hasta el lanzamiento público

### Design System V1 — Identidad visual

Ver [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md). Manual + logo en `apps/clickaton/public/brand/`.

Catálogo interno: `/design-system` (noindex, fuera de la navegación pública).

### Etapa 03 — Home MVP de lanzamiento

Home pública institucional con arquitectura de contenido en `content/home.ts`.

### Etapa 04 — Arquitectura pública y modelo de maratones

- Rutas: `/maratones`, `/como-funciona`, `/comunidad`, `/organizar`, `/sponsors`, `/nosotros`, `/contacto`
- Navegación por rutas reales (`config/navigation.ts`)
- Modelo tipado `PublicMarathon` y relacionados (`types/marathon.ts`)
- Documento: [PUBLIC_ARCHITECTURE.md](./PUBLIC_ARCHITECTURE.md)

### Etapa 05 — Ficha pública de maratón + contrato FotoRank

- Ruta `/maratones/[slug]` con fixture `/maratones/demo`
- Ficha completa: cronograma, categorías, bases, validaciones, premios, jurado, sponsors, organización, FAQ, estados
- Seguridad de consignas: `lib/challenges.ts`
- Contrato: [FOTORANK_INTEGRATION_CONTRACT.md](./FOTORANK_INTEGRATION_CONTRACT.md)
- Sin inscripción, pagos, backend ni integración real

### Etapa 05A — Consolidación de contratos satélite

- Tipos separados en `apps/clickaton/types/public/*` (inscripción, cupos, resultados, galería, capabilities, etc.)
- `PublicMarathon` permanece estructural; sin cambios de UI
- Documentación de arquitectura, matriz de consumo y dependencias Identity/Payments/CLF
- Sin endpoints ni comportamiento

### Etapa 06 — Adaptador / fuente de datos intercambiable

- Interfaz `PublicMarathonDataSource` + fuente local + servicio público
- Páginas sin import directo de fixtures
- Normalización, visibilidad y sanitizado servidor
- Documento: [DATA_ACCESS_ARCHITECTURE.md](./DATA_ACCESS_ARCHITECTURE.md)
- Sin fetch real a FotoRank

### Etapa 07 — Auditoría de integración real con FotoRank

Solo documentación (sin endpoints, Prisma ni cambios funcionales):

- [FOTORANK_REAL_INTEGRATION_AUDIT.md](./FOTORANK_REAL_INTEGRATION_AUDIT.md) — estado real FR, gaps, riesgos, arquitectura, plan 08+
- [FOTORANK_FIELD_MAPPING.md](./FOTORANK_FIELD_MAPPING.md) — mapeo campo a campo

Hallazgo clave: FotoRank tiene concursos/jurados/landing; **no** tiene maratón tipado, inscripción pública, pagos, consignas ni GPS/EXIF sobre obras FR.

### Backlog

Ver [BACKLOG.md](./BACKLOG.md).
