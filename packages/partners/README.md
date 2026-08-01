# `@repo/partners`

Dominio transversal **DNX Partners** (UI: Sponsors y beneficios).

## Principio

Un partner **no** implica pago. `requiresPayment` default `false`. Sin Mercado Pago, links, suscripciones ni recurrencias automáticas.

## Qué incluye

- Tipos y enums tipados
- Validadores (fechas, %, límites, activación de beneficios)
- Capabilities / asserts de permisos
- Casos de uso vía `PartnersService` + repositorio inyectable
- `MemoryPartnersRepository` para tests

## Persistencia

Tablas Prisma `DnxPartner*` en `@repo/db`. Cada app implementa el adapter (Clickatón: `lib/admin/partners/prisma-partners-adapter.ts`).

## No confundir

`@repo/payments` partner-onboarding = socios de cobro Split MP. Este paquete es CRM comercial de aliados/sponsors/beneficios.
