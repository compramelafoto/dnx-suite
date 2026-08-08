# Santa Fe en Foco — ETAPA 11B — Cierre acceso unificado + guards DB

**Fecha:** 2026-08-08  
**Resultado:** **PARTIAL** (Preview endurecido; Production **no** promovida — GO pendiente login Google real)  
**Branch:** `feat/sfef-etapa11-preview`  
**Preview 11B:** `dpl_HVeGt7Bna5gxEdSYwG3Baet9Ervi` → `https://fotorank.staging.dnxsuite.com`  
**Production vigente (rollback):** `dpl_8Sd9zEG6nZ1ZqgaVhRKa79zPQddg`

## DB Preview canónica

| Ámbito | Host hint |
|--------|-----------|
| Preview global (`gitBranch: null`) | `ep-round-fog-…` |
| Preview branch `migration-legacy-clf-to-monorepo` | `ep-round-fog-…` |
| Production | `ep-dawn-dew-…` |

Health Preview: `VERCEL_ENV=preview`, `dbIdentityOk=true`, `databaseHostHint=ep-round-fog-a4xgibtv-pooler`.

Dominio staging bound a `gitBranch=feat/sfef-etapa11-preview` (evita que Production robe el alias).

## Guards

- `apps/fotorank/app/lib/fotorank/db/environment-db-guard.ts`
- Bootstrap: `instrumentation.ts` aborta Preview↔prod / Production↔staging
- Health: `/api/public/health/db` → `dbIdentityOk`
- Selfcheck: `pnpm --filter fotorank run test:db:environment-guard` → **PASS**

## Validaciones 11B

| Check | Resultado |
|-------|-----------|
| E2E matriz 8/8 | **PASS** (fixtures regenerados; bypass SSO query) |
| Selfcheck permisos / home | **PASS** |
| Typecheck | **PASS** |
| Lint focalizado | **PASS** (2 warnings turbo env) |
| Build local (`next build --webpack`) | **PASS** |
| Actuar como (fixture SA) | participante → organizador → jurado → volver **PASS** |
| SA real `cuart.daniel@gmail.com` en staging DB | `globalRole=SUPER_ADMIN`, sin password (Google) |
| Login Google SA real automatizado | **PENDING** (interactivo; SSO + OAuth) |

## Deuda — sesión jurado paralela

Cookie `dnx_judge_session` (`app/lib/judge-auth.ts`) sigue siendo un sistema de auth separado de `dnx_session`.

**Confirmado en 11B (sin refactor):**

- login unificado no concede privilegios de jurado por sí solo (caso E2E 03 aterriza en `/jurado/login`);
- sesión DNX + contexto «Actuar como jurado» solo redirige al login jurado;
- no se unificó cookie ni se eliminó `FotorankJudgeAccount`.

**Etapa futura:** unificar identidad jurado con `dnx_session` / memberships, con migración de sesiones y auditoría.

## Rollback Production

1. Redeploy / alias al deployment anterior `dpl_8Sd9zEG6nZ1ZqgaVhRKa79zPQddg`
2. No tocar DB
3. No borrar sesiones/usuarios
4. No cambiar `globalRole` del Super Admin

## GO / NO-GO

**NO-GO Production** hasta:

1. Login Google interactivo de `cuart.daniel@gmail.com` en Preview (callback → `/mi-actividad` → `/super-admin` → Santa Fe admin)
2. PR mergeado a `release/fotorank-production`
3. Candidato Production con health `ep-dawn-dew` + `dbIdentityOk=true`
