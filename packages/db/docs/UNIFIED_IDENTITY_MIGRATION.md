# DNX Suite — Migracion de identidad unificada

## Diagnostico de estado actual

- `User.role` mezcla permisos globales y funcionales de apps (duplicacion semantica).
- `Membership` solo distingue `ADMIN` / `MEMBER` y no expresa acceso por app.
- Cada app aplica guards con reglas propias (riesgo de inconsistencia).

## Modelo nuevo (aditivo, compatible)

Se agrega sin borrar tablas legacy:

- `User.globalRole` (`GlobalRole`)
  - `SUPER_ADMIN`
  - `PLATFORM_SUPPORT`
  - `USER`
- `WorkspaceMembership` (`WorkspaceRole`)
  - `WORKSPACE_OWNER`
  - `WORKSPACE_ADMIN`
  - `STAFF`
- `WorkspaceAppAccess`
  - `app` (`FOTOFFICE`, `COMPRAMELAFOTO`, `FOTORANK`)
  - `enabled`
  - `appRole` (`SuiteAppRole`)

## Backfill incluido en migracion SQL

- `User.globalRole` desde `User.role`:
  - `SUPER_ADMIN` -> `SUPER_ADMIN`
  - `ADMIN` -> `PLATFORM_SUPPORT`
  - resto -> `USER`
- `WorkspaceMembership` desde `Membership`:
  - `ADMIN` -> `WORKSPACE_OWNER`
  - `MEMBER` -> `STAFF`

## Estrategia de rollout recomendada

1. Deploy de schema + migracion `20260401123000_unified_identity_roles`.
2. Deploy de `packages/auth` con `getSessionIdentityByRawToken`.
3. Adaptar guards de cada app a `globalRole + workspaceRole + appAccess`.
4. Ejecutar seed de unificacion para usuarios bootstrap.
5. Fase 2 (opcional): deprecacion gradual de `User.role` y `Membership`.
