# DNX Notifications — Etapa 24 — Informe de commits locales

Fecha: 2026-07-24  
Rama: `migration-legacy-clf-to-monorepo`  
Repo: `dnx-suite`  
Push: **NO EJECUTADO**  
Production: **NO TOCADA**

---

## A. Estado inicial

| Campo | Valor |
|-------|--------|
| Repo | `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite` |
| Rama | `migration-legacy-clf-to-monorepo` |
| HEAD inicial | `657562f` (`chore(clickaton): prepare staging environment for funnel validation`) |
| Staged inicial | vacío |
| Merge/rebase/cherry-pick | no |
| Working tree | mezclado (~80+ entradas): Notifications + Clickaton + feed + payments + EI + recommendations |

Snapshot pre-commit: `docs/notifications/notifications-etapa-24-precommit-snapshot.md`.

---

## B. Commits creados

| Orden | Hash corto | Mensaje | Archivos (aprox.) | Resultado |
|------:|------------|---------|-------------------|-----------|
| 1 | `ee23115` | `feat(geo): add shared geographic ranking foundation` | 28 | OK |
| 2 | `eba6485` | `feat(notifications): add shared notifications engine` | 22 | OK |
| 3 | `274de5f` | `feat(db): add notification campaigns deliveries and preferences` | 9 | OK |
| 4 | `2ebfa2e` | `feat(infospot): add photographer notification campaign workflow` | 53 | OK |
| 5 | `fbbc587` | `feat(compramelafoto): add notification inbox preferences and attribution` | 9 | OK |
| 6 | `81b7809` | `test(notifications): add QA tooling and cross-app browser coverage` | 12 | OK |
| 7 | *(este commit)* | `docs(notifications): add engine runbook QA and release documentation` | `docs/notifications/**` + `docs/geo/**` | OK |

Base → HEAD final: `657562f..HEAD` (7 commits locales del Notifications Engine).

---

## C. Geo

- **Incluido:** `packages/geo/**` completo.
- **Tests:** `pnpm --filter @repo/geo test` / `check-types` / `lint` — OK (11 tests).
- **Nota:** lockfile en HEAD ya referenciaba `@repo/geo`; no hubo diff de `pnpm-lock.yaml` en esta etapa.

---

## D. Notifications Core

- **Incluido:** `packages/notifications/**` completo.
- **Tests:** `pnpm --filter @repo/notifications test` (23) / `check-types` / `lint` — OK.

---

## E. DB

- **Schema:** modelos/enums `DnxNotification*` + `canNotifyClfPhotographerCall` (diff aditivo limpio).
- **Migraciones:**
  - `20260723180000_dnx_notifications_engine_etapa18` (motor)
  - `20260723070000_infospot_etapa13_clf_perms_and_article_geo` (prereq `canProvision` + geo artículos)
- **Scripts gate:** `apply|check|smoke-dnx-notifications*`
- **Permisos:** `canProvision*` / `canNotify*` en `infospot-permissions.ts` + re-exports `client.ts`
- **Exports:** `./permissions` y `./clf-album-availability` en `packages/db/package.json`
- **SQL destructivo:** no (`DROP`/`TRUNCATE` ausentes)
- **`migrate deploy` global:** no ejecutado

---

## F. InfoSpot

- Panel `/admin/notificaciones`, detalle, ops UI
- Preview `nearby-notify`, campañas, worker, reconcile
- Cron `/api/cron/notifications-outbox` + `vercel.json` `*/2`
- Feature flags `DNX_NOTIFICATIONS_*` (Production OFF por defecto)
- Wiring permisos (usuarios, google-login, editor, photographer-call)
- Boundary Turbopack: imports `@repo/db/permissions` / `clf-album-availability` (solo hunks)
- Scripts ops: worker / reconcile / cron-auth-check / browser-smoke
- **Tests:** `pnpm --filter infospot test` (= etapas 18–23) OK; `check-types` OK

### Archivos mixtos (commit 4)

| Archivo | Incluido | Excluido |
|---------|----------|----------|
| `apps/infospot/package.json` | deps `@repo/geo`/`@repo/notifications`, `@playwright/test`, scripts etapa-18..23, `notifications:*`, `test:e2e:notifications*` | feed / EI / recommendations / `qa:11b` |
| `turbo.json` | `DNX_NOTIFICATIONS_*`, CLF URLs, `RESEND_API_KEY`, `VERCEL_URL` | `ALLOW_INFOSPOT_QA_SEED`, `FEED_INTEGRATION_REQUIRE_DB` |
| `article-view.tsx` | import `clf-album-availability` | bloques feed/recommendations |
| `article-form.tsx` | import `@repo/db/permissions` | geo artículo / EI panel |

Working tree restaurado a versión completa tras stage (index intacto). Un typecheck intermedio falló solo mientras el WT tenía versiones “notif-only” de article-view/form frente a callers feed — **caso 1** (interferencia WT mezclado); desapareció al restaurar backups en disco.

---

## G. CLF

- Bandeja `/fotografo/notificaciones`
- Preferencias `/fotografo/configuracion/notificaciones` + server actions
- Tracking + CTA `/n/[token]`
- Attribution en join `events/[shareSlug]/join`
- Nav Avisos/Notificaciones
- `lib/geo.ts` delega en `@repo/geo`; dep workspace en `package.json`
- **Excluido:** `next-env.d.ts` (artefacto Next local)
- **Typecheck:** fallos **solo** baseline `@repo/payments` (BigInt / exports) — **caso 3**; sin errores en archivos de notificaciones

---

## H. QA/E2E

- Scripts `notifications:qa-*`, Playwright config 1.51.1, specs InfoSpot/CLF/atribución
- `.gitignore`: `test-results/`, `playwright-report/`, `blob-report/`
- **Artifacts no committeados:** `.qa-artifacts/`, traces, screenshots, storage states
- **E2E en esta sesión:** primer intento falló por binario Chromium Playwright ausente (`chromium_headless_shell-1161`). Reintento de `playwright install` interrumpido. **Observación:** cobertura e2e no revalidada 11/11 en Etapa 24; tests contractuales etapas 18–23 OK.

---

## I. Docs

Incluidos:

- `docs/notifications/**` (engine, runbook, QA 20–23, matrices, rollback, snapshot E24, este informe)
- `docs/geo/dnx-geo-engine.md` (fundación geo del motor)

Secret review docs: sin passwords/tokens/URLs privadas con secretos; solo nombres de variables y placeholders.

**Excluidos:** `docs/infospot/62–65` (feed / EI / recommendations).

---

## J. Cambios excluidos (permanecen en working tree)

- Clickaton (marketing, images, payments smoke)
- `packages/payments/**` y cambios Clickaton payments
- Feed InfoSpot (`lib/feed/**`, home feed, API public feed)
- Editorial intelligence / recommendations
- `apps/dnx-sales-assistant/**`
- Artifacts QA / `.env` / secretos

---

## K. Archivos mixtos (resumen)

Ver sección F. Estrategia: merge programático JSON + escritura selectiva de archivos TSX (equivalente a `git add -p`), restore de working tree completo post-stage.

---

## L. Secret scan

Rango `657562f..HEAD` revisado por patrones (`CRON_SECRET=`, `RESEND_API_KEY=`, `DATABASE_URL=`, `AUTH_SECRET=`, `Bearer `, passwords hardcodeadas).

- **Resultado:** solo nombres de variables, comentarios de uso y hashes bcrypt de fixtures QA (override por `DNX_NOTIFICATIONS_QA_PASSWORD`).
- **Sin** valores de Production ni API keys reales en el historial committeado.

---

## M. Validación en HEAD limpio

- Worktree temporal: `/tmp/dnx-notifications-release-check` sobre `fbbc587` + patch staged del commit 6.
- `infospot check-types` en worktree limpio: **OK**
- `compramelafoto typecheck` en worktree limpio: **solo errores `@repo/payments`** (baseline)
- Dependencias accidentales del WT mezclado: **no detectadas** para el staged de QA
- Worktree eliminado al finalizar commit 6

Validación adicional post-commit 7: tests unitarios geo/notifications/infospot etapas (ver sección final operativa).

---

## N. Working tree final (esperado)

- **Staged:** vacío tras commit 7
- **Unstaged/untracked:** Clickaton, payments, feed, EI, recommendations, diffs residuales de `package.json`/`turbo` (hunks ajenos), etc.
- Sin cambios de Production

---

## O. Push

```text
NO EJECUTADO
```

---

## P. Production

```text
NO TOCADA
```

---

## Q. Estado final

```text
COMMITS LOCALES CREADOS CON OBSERVACIONES
```

### Observaciones

1. E2E Playwright 11/11 no re-ejecutado con éxito en esta sesión (browser Playwright no instalado / install interrumpido). Tests unitarios y contractuales 18–23 OK.
2. CLF typecheck sigue fallando por baseline preexistente `@repo/payments` (documentado en Etapa 23).
3. Working tree permanece mezclado a propósito; no se incluyeron cambios ajenos.
4. HEAD inicial real fue `657562f`, no `57395f7` del informe E23.

### Criterios cumplidos

- 7 commits locales atómicos
- Sin push / sin Production
- Sin ajenos / sin secretos / sin artifacts QA en commits
- Staged limpio al cierre
- Informe final presente
