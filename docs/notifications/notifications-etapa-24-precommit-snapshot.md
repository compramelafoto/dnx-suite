# Etapa 24 — Snapshot pre-commit

Fecha: 2026-07-24  
Repo: `dnx-suite`  
Rama: `migration-legacy-clf-to-monorepo`  
HEAD inicial: `657562f` (`chore(clickaton): prepare staging environment for funnel validation`)  
Staged inicial: vacío  
Merge/rebase/cherry-pick: ninguno  

Nota: el readiness de Etapa 23 citaba `57395f7`; el HEAD real al iniciar Etapa 24 es `657562f`.

## Advertencias

1. Working tree mezclado (~131 entradas) con Clickaton, feed, payments, EI, recommendations.
2. `pnpm-lock.yaml` en HEAD ya referencia `packages/geo` y `packages/notifications` aunque esos directorios estaban untracked — commit 1–2 corrigen ese desfase.
3. `turbo.json` mezcla envs feed (`ALLOW_INFOSPOT_QA_SEED`, `FEED_INTEGRATION_REQUIRE_DB`) con envs Notifications — staging selectivo.
4. `apps/infospot/package.json` mezcla scripts feed/EI/recs con notifications — staging selectivo vía merge programático (equivalente a `git add -p`).
5. Sin secretos ni artifacts en la selección prevista.

## Commits preliminares

| # | Mensaje |
|---|---------|
| 1 | `feat(geo): add shared geographic ranking foundation` |
| 2 | `feat(notifications): add shared notifications engine` |
| 3 | `feat(db): add notification campaigns deliveries and preferences` |
| 4 | `feat(infospot): add photographer notification campaign workflow` |
| 5 | `feat(compramelafoto): add notification inbox preferences and attribution` |
| 6 | `test(notifications): add QA tooling and cross-app browser coverage` |
| 7 | `docs(notifications): add engine runbook QA and release documentation` |

## Excluidos (permanecen en working tree)

Clickaton, payments, feed InfoSpot, editorial-intelligence, recommendations, sales-assistant, artifacts `.qa-artifacts` / Playwright reports.
