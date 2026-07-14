# Clickaton — documentación

## Etapa 01 — Fundación técnica

Creación de `apps/clickaton` en DNX Suite: frontend público independiente, integrado al monorepo, sin lógica de negocio.

### Qué se entregó

- App Next.js en el workspace pnpm + Turbo
- Home fundacional responsive (amarillo / negro / blanco)
- Configuración central de marca y navegación MVP
- Tokens visuales base
- Wordmark tipográfico provisional
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

### Sistema de Diseño MVP (Etapa 02)

Ver [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

Catálogo interno: `/design-system` (noindex, fuera de la navegación pública).

### Etapa 03 — Home MVP de lanzamiento

Home pública institucional con arquitectura de contenido en `content/home.ts`:

- Qué es, pilares, cómo funciona, próximas (placeholder)
- Pedagogía, comunidad, programa de sedes, sponsors
- Manifiesto, FAQ (`details`/`summary`), CTA final
- Sin datos inventados (ciudades, fechas, precios, logos)
- Sin inscripción, FotoRank, pagos ni tienda

### Backlog

Ver [BACKLOG.md](./BACKLOG.md).
