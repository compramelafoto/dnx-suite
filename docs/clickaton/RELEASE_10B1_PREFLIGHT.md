# RELEASE 10B.1 — Preflight

**Fecha:** 2026-07-28  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD (cierre docs):** ver commits en informe final  
**Veredicto 10B previo:** `DEPLOY BLOCKED`

## Git

| Ítem | Valor |
|------|--------|
| Remote | `origin` → `https://github.com/compramelafoto/dnx-suite.git` |
| Commits 10B base | `3870015`, `b3b3c78`, `8d59ce0` |
| WIP ajeno | Infospot / FotoRank P0 / editorial / recommendations — **no tocar** |
| Clickatón dirty local | `schema.prisma` ampliado (jury/WIP) restaurado localmente; no mezclado en commits salvo `binaryTargets` |

## Auth herramientas

| Tool | Estado |
|------|--------|
| Vercel CLI | OK (`compramelafoto` / team `compramelafotos-projects`) |
| Neon CLI | OK (`dnxfotografia` / org `Dnx`) |
| GitHub CLI | **NO** — `MANUAL ACTION REQUIRED: gh auth login` |
| Auth0 | N/A (Google/DNX) |
| Mercado Pago admin | no usado para conectar cuenta Tammy |

## Proyectos

| Rol | Vercel | Dominio | Neon |
|-----|--------|---------|------|
| Staging | `clickaton-staging` (`prj_MM6Bk…`) | `clickaton-staging.vercel.app` | proyecto `clickaton-staging` (`plain-sky-50672248`), branch `clickaton-staging`, DB `clickaton_staging`, endpoint `ep-divine-smoke-av8hmt7s*` |
| Production | `clickaton-dnxsuite` (`prj_wo7NX…`) | `maratonfotografica.com` | **sin proyecto Neon Clickatón Production en la org** |
| Local incorrecto | `.env` / `.env.local` | — | `ep-dawn-dew-adyr8f1v*` / `neondb` (**no** es Staging) |

## Backup

Neon branch `backup-10b1-pre-migrate` (`br-muddy-firefly-avs5gej4`) creado desde `clickaton-staging` antes de `migrate deploy`.
