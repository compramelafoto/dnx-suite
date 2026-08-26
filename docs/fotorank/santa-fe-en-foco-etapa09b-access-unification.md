# Santa Fe en Foco — ETAPA 09B — Unificación del acceso

**Fecha:** 2026-08-05  
**Alcance:** staging — **sin commit, sin push, sin deploy Production**  
**Estado final:** **PARTIAL** (código + staging Preview OK; matriz de usuarios E2E con fixtures reales pendiente)

## Staging

| Campo | Valor |
|-------|--------|
| Preview | `dpl_54emZY5e4CHFsQNdbnyEaUuXmBYb` |
| Alias | `https://fotorank.staging.dnxsuite.com` |
| Production | **no tocada** |

## Cambio de modelo

- Eliminada la elección pre-login Organizador / Jurado (`LoginChoiceModal`).
- Login único: `/login` (Google + email).
- Post-login: `resolveHomeCapabilities` + `resolvePostLoginPath`.
- Hub personal: `/mi-actividad` (secciones según capacidades).
- Super Admin: `/super-admin` (reutiliza Prisma; sin login distinto).

## Destinos

| Capacidades | Destino |
|-------------|---------|
| Solo participante | `/participaciones` |
| Solo organizador | `/dashboard` |
| Solo jurado (cuenta Judge por email) | `/jurado/login?next=/jurado/panel` |
| Varias / super admin / ninguna | `/mi-actividad` |
| `?next=` seguro | respeta `next` |

## Tests

- Selfcheck destinos: `pnpm --filter fotorank run test:access:home-capabilities` → **8/8 PASS**
- Playwright staging (`e2e/santa-fe-09b-access-unification.spec.ts`): **3/3 PASS**

## Notas jurado

`FotorankJudgeAccount` sigue siendo sesión separada (`dnx_judge_session`). El hub detecta jurado por email y enlaza al panel; no se inventó un sistema paralelo de permisos.
