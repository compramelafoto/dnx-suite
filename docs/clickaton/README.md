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

### Design System V2 — Identidad visual editorial

Ver [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md). Manual + logo en `apps/clickaton/public/brand/`.

- Fondo oscuro `#111`; amarillo `#FFC400` solo como acento (nunca hero fill)
- Sistema fotográfico: [PHOTOGRAPHY_GUIDELINES.md](./PHOTOGRAPHY_GUIDELINES.md) · `PhotoFrame` / variantes
- Catálogo interno: `/design-system` (noindex, fuera de la navegación pública)

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

### Etapa 08A — Contrato servidor V1 (FotoRank)

Serialización pública segura en `apps/fotorank/app/lib/public-api/v1/` (`FotorankPublicEventV1`, loaders, visibility).

- Sin Route Handlers HTTP (completado en 08B)
- Sin adaptador Clickaton (08D)
- Sin cambios Prisma
- Doc local: `apps/fotorank/app/lib/public-api/v1/README.md`

### Etapa 08B — Route Handlers públicos V1 (FotoRank)

Endpoints HTTP versionados (listado + detalle):

- `GET /api/public/v1/events`
- `GET /api/public/v1/events/[slug]`

Consumen loaders/serializers 08A. Envelope V1, headers de versión, caché corta, **sin CORS abierto**. Clickaton **aún no** los consume (adaptador server-to-server = 08D).

- Doc: `apps/fotorank/app/api/public/v1/README.md`
- Sin cambios en `apps/clickaton` (código)

### Etapa 08C / 09A — Canal + tipo de experiencia

- Discriminador `distributionChannel` (08C) + `experienceType` CONTEST|MARATHON (09A)
- Clickatón oficial = `MARATHON` + `CLICKATON`
- Adaptador HTTP Clickaton → FR ([FOTORANK_PUBLIC_INTEGRATION.md](./FOTORANK_PUBLIC_INTEGRATION.md))
- Migraciones aditivas: `20260715150000_fotorank_public_event_channel` · `20260715160000_fotorank_experience_type`

### Etapa 09 — Inscripciones pagas y merchandising (alcance)

Documento: [STAGE_09_PAID_REGISTRATION_AND_MERCHANDISING.md](./STAGE_09_PAID_REGISTRATION_AND_MERCHANDISING.md)

| Sub-etapa | Entrega |
|-----------|---------|
| **09A** | Contratos/estados free\|paid, `displayPrice`, merch opcional, `checkoutUrl`; handoff. **Sin** cobros reales ni split |
| **09B** | Admin cobro, órdenes+líneas, productos/variantes/stock, checkout, MP, webhook, idempotencia |
| **09C** | Split, collector organizador, comisiones por línea, devoluciones, panel económico |

Tipos Clickaton ampliados: `apps/clickaton/types/public/registration.ts`.

### Etapa 10B — Panel admin shell

- Rutas `/admin/*` separadas del sitio público (`app/(public)` vs `app/admin`)
- Auth DNX Identity (`dnx_session`) + `requireClickatonAdmin()`
- Menú MVP + empty states + integraciones informativas (FotoRank / DNX Payments)
- Doc: [ADMIN_PANEL.md](./ADMIN_PANEL.md)

### Backlog

Ver [BACKLOG.md](./BACKLOG.md).
