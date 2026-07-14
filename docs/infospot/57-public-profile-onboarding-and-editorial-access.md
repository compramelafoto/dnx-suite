# 57 — Perfiles públicos múltiples y onboarding post-login (22R / 22R-B)

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Estado:** implementado; **staging** (`ep-dawn-dew…`) migrado + backfill; **Production** (`ep-bitter-salad…`) migrado + backfill en 22R-C — ver [`59`](./59-public-profiles-production-migration.md)

No incluye emails ni secretos.

---

## Separación de capas

| Capa | Modelo | Quién asigna |
|------|--------|--------------|
| Identidad | `User` | OAuth / invitación / registro |
| Perfiles públicos multi | `DnxUserProfile` | Self / CLF backfill / admin |
| Preferencias Info Spot | `InfoSpotUserPreferences` | Self |
| Editorial | `InfoSpotUserRole` | Director / `DnxAppInvitation` |
| Legacy CLF | `User.role` | No se degrada; promoción segura solo desde `CUSTOMER` |

Perfiles públicos UI: **CUSTOMER** («Quiero descubrir eventos»), **PHOTOGRAPHER**, **ORGANIZER**.  
No aparecen Director / Redactor / Colaborador / Jurado en onboarding.

---

## Flujo

1. Login Google o email → `loadPostLoginDestination`.
2. Sin onboarding y sin perfiles ACTIVE → `/completar-perfil`.
3. Con perfiles → `/` o `next` seguro.
4. `next` editorial sin `InfoSpotUserRole` → `/ingresar/acceso-pendiente` (cuenta pública no bloqueada).
5. Con rol editorial → `/redaccion` (o next).
6. Invitación: enlace secundario «¿Fuiste invitado…?» → flujo `/invitar/[token]`.

---

## Migración y backfill

```bash
# Staging primero (packages/db/.env → dawn-dew)
pnpm --filter @repo/db exec prisma migrate deploy
pnpm --filter @repo/db db:backfill-dnx-user-profiles
```

### Staging (2026-07-13)

| Check | Resultado |
|-------|-----------|
| Host | `ep-dawn-dew-adyr8f1v…` |
| Migración `20260714010000_…` | Aplicada |
| Backfill | `users:15` → customer 15 / photographer 8 / organizer 1; `onboardingMarked:6` |
| Build Info Spot | OK (`/completar-perfil` en rutas) |
| Tests | `test:post-login-destination` OK |

Production: aplicada en 22R-C ([`59`](./59-public-profiles-production-migration.md)).

---

## Archivos clave

- `packages/db/prisma/schema.prisma` — modelos + enums
- `apps/infospot/lib/dnx-user-profiles.ts`
- `apps/infospot/lib/post-login-destination.ts`
- `apps/infospot/app/completar-perfil/`
- `apps/infospot/app/ingresar/acceso-pendiente/page.tsx`
- `apps/infospot/lib/google-login.ts`

---

## Seguridad

- El cliente solo envía intenciones de perfil público (`CUSTOMER` / `PHOTOGRAPHER` / `ORGANIZER`).
- No puede autoasignar `InfoSpotUserRole`.
- Open redirects bloqueados con `safeInfoSpotNextPath`.
