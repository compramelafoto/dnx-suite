# FotoRank — Super Admin inicial

**Fecha:** 2026-08-05  
**Usuario canónico:** `cuart.daniel@gmail.com`  
**Fuente de verdad:** `User.globalRole = SUPER_ADMIN` (DNX Identity)

## Grant (no parche ad-hoc)

```bash
SFEF_ALLOW_SUPER_ADMIN_GRANT=1 \
SUPER_ADMIN_EMAIL=cuart.daniel@gmail.com \
  pnpm --filter @repo/db exec tsx prisma/scripts/ops-grant-fotorank-super-admin.ts
```

API reutilizable: `ensureGlobalSuperAdmin` / `grantGlobalRole` en `@repo/auth` (`packages/auth/src/global-role.ts`).

## Capacidades

- Acceso a cualquier concurso **sin** membresía `ContestOrganizationMember` (`assertOrganizerCanAccessContest` bypass).
- Dashboard organizador lista **todas** las organizaciones.
- «Actuar como organizador»: cookie `fotorank_sa_act_as_org_id` (sin mutar DB de permisos).
- Auditoría: `FotorankPlatformAuditEvent` (usuario, fecha, IP, acción, org, concurso).

## Staging

- Deploy: `dpl_h8bPrUX7mBPv2e5vCFXt5StzhDR8` → `fotorank.staging.dnxsuite.com`
- Production alias **no** modificado en este paso de código.

## Validación esperada

Login con `cuart.daniel@gmail.com` → hub `/mi-actividad` con sección **Super Administración** (sin elegir rol).
