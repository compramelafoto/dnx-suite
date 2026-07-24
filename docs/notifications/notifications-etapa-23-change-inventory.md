# Etapa 23 — Inventario de cambios del Notifications Engine

Fecha: 2026-07-23  
Rama: `migration-legacy-clf-to-monorepo`  
HEAD de referencia al inventario: ver informe de readiness (working tree mezclado).

**Regla:** este inventario lista lo que debe entrar en commits de notificaciones. Todo lo demás es **ajeno** y no debe `git add` accidentalmente.

---

## Resumen cuantitativo (preflight)

| Métrica | Valor aprox. |
|---------|----------------|
| Entradas `git status --short` | ~132 |
| Untracked | ~186 paths |
| Diff modified | ~80 files / +2270 −718 (incluye ajenos) |

---

## 1. Paquete compartido (obligatorio)

| Path | Propósito | Etapa | Release |
|------|-----------|-------|---------|
| `packages/notifications/**` | Motor puro: audience, policies, templates, worker-config, tests | 18–19 | **Sí** |
| `packages/geo/**` | Dep runtime de `@repo/notifications` (`audience.ts`) | 13/geo + 18 | **Sí** (paquete completo; no meter `apps/infospot/lib/feed`) |

---

## 2. Base de datos (obligatorio)

| Path | Propósito | Etapa | Notas |
|------|-----------|-------|-------|
| `packages/db/prisma/migrations/20260723180000_dnx_notifications_engine_etapa18/` | DDL aditivo motor | 18 | Gate `apply-dnx-notifications-migration.mts` |
| `packages/db/scripts/apply-dnx-notifications-migration.mts` | Apply controlado + registro `_prisma_migrations` | 18 | |
| `packages/db/scripts/check-dnx-notifications-tables.mts` | Verificación tablas | 18 | |
| `packages/db/scripts/smoke-dnx-notifications.mts` | Smoke Prisma | 18 | |
| `packages/db/prisma/schema.prisma` | Models/enums/relations Dnx* + `canNotify*` | 18 | Diff actual limpio notif |
| `packages/db/src/infospot-permissions.ts` | `canNotify*` (+ `canProvision*` etapa 13) | 13+18 | Commit perms conjunto |
| `packages/db/src/client.ts` | Re-exports permisos | 13+18 | |
| `packages/db/package.json` | Export `./permissions` (+ `./clf-album-availability` E22) | 22 | Preferir `git add -p` o commit exports |
| `packages/db/prisma/migrations/20260723070000_infospot_etapa13_clf_perms_and_article_geo/` | DDL `canProvision` + geo artículos | 13 | **Prereq DB** si host no lo tiene; no es SQL del motor 18 |

---

## 3. InfoSpot (obligatorio)

### Código motor / ops

| Path | Propósito |
|------|-----------|
| `apps/infospot/lib/notifications/**` | Worker, campaign, metrics, reconcile, QA, flags, tests 18–23 |
| `apps/infospot/app/actions/nearby-notify.ts` | Preview audiencia |
| `apps/infospot/app/actions/notification-campaigns.ts` | Acciones admin campaña |
| `apps/infospot/app/admin/notificaciones/**` | Panel listado/detalle |
| `apps/infospot/app/api/cron/notifications-outbox/route.ts` | Cron protegido + kill switch |
| `apps/infospot/components/admin/notification-campaign-ops.tsx` | Acciones UI |
| `apps/infospot/components/redaccion/nearby-notify-panel.tsx` | Panel envío en editor |
| `apps/infospot/scripts/notifications-*.ts` | Worker/reconcile/QA/cron-check |
| `apps/infospot/e2e/**` + `playwright.config.ts` | Browser coverage |
| `apps/infospot/vercel.json` | Schedule `*/2` outbox |
| `apps/infospot/.gitignore` | `.qa-artifacts`, Playwright artifacts |

### Wiring permisos / UI (mixto pero necesario)

| Path | Qué incluir |
|------|-------------|
| `apps/infospot/lib/infospot-access.ts` | Flags notify (+ provision) |
| `apps/infospot/app/actions/users.ts` | Persistencia checkboxes |
| `apps/infospot/app/admin/usuarios/*` | UI permisos |
| `apps/infospot/app/admin/page.tsx` | Link panel notificaciones |
| `apps/infospot/lib/google-login.ts` | Defaults director |
| `apps/infospot/app/actions/photographer-call.ts` | Guard provision (prereq) |
| `apps/infospot/app/redaccion/eventos/[id]/editar/page.tsx` | Props canNotify/canProvision |
| `apps/infospot/components/redaccion/event-editor-form.tsx` | `canNotifyCall` (+ hunks geo → `add -p`) |
| `apps/infospot/components/redaccion/photographer-call-panel.tsx` | NearbyNotifyPanel + UX call status |
| `apps/infospot/lib/clf-event-provisioning/call-display-status.ts` | Dep del panel (si se incluye panel) |
| Boundary Turbopack E22 | `event-adapter`/`article-adapter` → `@repo/db/permissions`; client components permissions/clf-album |

### `package.json` InfoSpot

Incluir solo vía `git add -p`:

- deps: `@repo/notifications`, `@repo/geo` (si va el paquete), `@playwright/test`
- scripts: `test:etapa-18`…`23`, `notifications:*`, `test:e2e:notifications*`

**Excluir** scripts/deps de feed, editorial-intelligence, recommendations si se quieren commits puros.

---

## 4. ComprameLaFoto (obligatorio)

| Path | Propósito |
|------|-----------|
| `apps/compramelafoto/lib/notifications/tracking.ts` | Read/click/cookie/attribution |
| `apps/compramelafoto/app/n/[token]/route.ts` | CTA tracking |
| `apps/compramelafoto/app/fotografo/notificaciones/page.tsx` | Bandeja |
| `apps/compramelafoto/app/fotografo/configuracion/notificaciones/page.tsx` | Preferencias |
| `apps/compramelafoto/app/actions/notification-preferences.ts` | Server actions prefs |
| `apps/compramelafoto/app/api/public/events/[shareSlug]/join/route.ts` | Attribution al join |
| `apps/compramelafoto/config/navigation.ts` | Links Avisos/Notificaciones |
| `apps/compramelafoto/package.json` | Solo si se versiona `@repo/geo` en CLF |

Email real: `EmailQueue` + cron `process-email-queue` **ya existentes** en CLF (no son archivos nuevos del motor; activación Resend es operativa).

---

## 5. Documentación (obligatorio)

| Path |
|------|
| `docs/notifications/dnx-notifications-engine.md` |
| `docs/notifications/notifications-operations-runbook.md` |
| `docs/notifications/notifications-etapa-20-qa-report.md` |
| `docs/notifications/notifications-etapa-21-browser-qa-report.md` |
| `docs/notifications/notifications-etapa-22-staging-activation-report.md` |
| `docs/notifications/notifications-etapa-23-*.md` (este + readiness + matrices) |
| `docs/notifications/notifications-environment-matrix.md` |
| `docs/notifications/notifications-email-activation-checklist.md` |
| `docs/notifications/notifications-release-rollback.md` |

---

## 6. Workspace / Turbo (parcial)

| Path | Estrategia |
|------|------------|
| `pnpm-lock.yaml` | Regenerar tras stage de packages notif/geo; no mezclar con payments |
| `turbo.json` | Incluir solo vars `DNX_NOTIFICATIONS_*` (+ CLF URLs / RESEND si se toca); `add -p` si hay envs de feed |

---

## 7. Cambios ajenos (NO incluir)

| Área | Ejemplos |
|------|----------|
| Clickaton marketing/payments smoke | `apps/clickaton/**` (pages, images, MP scripts) |
| Payments | `packages/payments/**` |
| Sales assistant | `apps/dnx-sales-assistant/**` |
| Feed / home geo | `apps/infospot/lib/feed/**`, `HomeNovedadesFeed`, `api/public/feed/**`, docs 62/63 |
| Editorial intelligence | `packages/editorial-intelligence/**`, panel/actions EI, docs 64 |
| Recommendations | `packages/recommendations/**`, docs 65 |
| Redacción/geo artículos no notif | article-form, cover, homepage-distribution, geocode routes, etc. |

---

## 8. Artifacts / secretos (excluir siempre)

| Path / patrón | Estado |
|---------------|--------|
| `apps/infospot/.qa-artifacts/` | gitignored |
| `apps/infospot/test-results/`, `playwright-report/` | gitignored |
| `.env*` | gitignored |
| Password fixture QA en `qa-kit.ts` | No es secreto cloud; override con `DNX_NOTIFICATIONS_QA_PASSWORD` |

---

## 9. Archivos mixtos → `git add -p`

1. `apps/infospot/package.json`
2. `apps/infospot/components/redaccion/event-editor-form.tsx`
3. `apps/infospot/components/redaccion/photographer-call-panel.tsx` (o commit panel aparte)
4. `packages/db/package.json` (permissions vs clf-album)
5. `turbo.json` (envs notif vs feed)
6. `pnpm-lock.yaml` (tras decidir packages)

---

## 10. Dependencias entre commits

```text
packages/geo
   → packages/notifications
   → schema + migration 18 (+ perms / migration 13 si hace falta)
   → InfoSpot adapters + cron + panel
   → CLF tracking/prefs/join
   → QA/e2e
   → docs
```
