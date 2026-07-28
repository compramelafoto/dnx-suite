# RELEASE 10B — Preflight final

**Fecha:** 2026-07-28  
**Readiness 10A/10A.1:** `READY FOR ETAPA 10B WITH WARNINGS` — se autoriza continuar.

## Repositorio

| Ítem | Valor |
|------|--------|
| Ruta | `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite` |
| Rama | `migration-legacy-clf-to-monorepo` |
| HEAD (inicio 10B) | `aa92de8e80ae2510db3255f694ad03c348bcd720` |
| Remote | `origin` → `https://github.com/compramelafoto/dnx-suite.git` |
| Ahead remote | 24 (antes de commits 10B) |
| Working tree | ~309 paths dirty |
| Lockfile | `pnpm-lock.yaml` modificado |
| Symlinks | solo workspace `node_modules` |

## Bloqueos de código 10A.1 (confirmados)

| Ítem | Estado |
|------|--------|
| OAuth connect/callback binding | OK — sin `PENDING_RUNTIME_BINDING` |
| OAuth revoke/reconnect binding | OK |
| Vault + finance actor | OK (código) |
| Email outbox idempotente | OK (`selfcheck:email-idempotency`) |
| Reconciliación cron | OK (`/api/cron/payments-reconciliation`) |
| Migraciones welcome / FR P0-06 | Remediadas en SQL (expand / abort enum) |
| check-env local | 0 blocks |

## Evidencia checks preflight

- `rg PENDING_RUNTIME_BINDING` en rutas MP → **NO_STUBS**
- `@repo/payments test` → **221 pass**
- `selfcheck:email-idempotency` → OK
- `pnpm clickaton:release:check-env` (local) → 0 blocks

## WIP ajeno (excluir del stage)

- `apps/infospot/**`
- `packages/editorial-intelligence/**`
- `packages/recommendations/**`
- `.env*` / secretos
- Artefactos temporales

## Herramientas

| Tool | Disponible | Nota |
|------|------------|------|
| Git | Sí | |
| Vercel CLI | Sí (`compramelafoto`) | proyectos clickaton-staging / clickaton-dnxsuite |
| `gh` | CLI sí / **auth no** | PR = MANUAL ACTION REQUIRED |
| Auth0 CLI | No | Auth0 **N/A** — DNX + Google |
| Docker | No | migrate from-zero local limitado |
| Neon | Histórico P1001 | migrate prod = verificar acceso |
| Playwright | Sí | smoke parcial |

## Feature flags de release (obligatorio)

- Inscripciones: **cerradas** (`registrationEnabled=false`)
- `DNX_SOCIAL_PUBLISHER_LIVE=false`
- Owner OAuth flags: OFF hasta ventana controlada
- Sin cobros LIVE en esta etapa

## Cierre preflight → ejecución

Veredicto post-ejecución 10B: **DEPLOY BLOCKED** — detalle en `RELEASE_10B_DEPLOY_REPORT.md`.

| Hecho | Pendiente |
|-------|-----------|
| Commits `3870015` + `b3b3c78` pusheados | PR (`gh auth`) |
| Staging Vercel READY | `/maratones` 500 Prisma |
| Migraciones OK en Neon local `ep-dawn-dew` | Confirmar misma DB en Vercel Staging/Prod |
| Social LIVE=false en Vercel | Vars MP OAuth / Resend / crons prod |
| Build webpack OK | Redeploy `maratonfotografica.com` |