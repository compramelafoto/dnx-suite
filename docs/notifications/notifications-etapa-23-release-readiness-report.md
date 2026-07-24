# Etapa 23 — Release readiness (Notifications Engine)

Fecha: 2026-07-23  
Rama: `migration-legacy-clf-to-monorepo`  
HEAD al cierre de informe: consultar `git rev-parse HEAD` en el momento del commit autorizado.  
**No commit / no push / no Production** en esta etapa.

---

## A. Preflight

| Ítem | Valor |
|------|--------|
| Repo | `dnx-suite` |
| Rama | `migration-legacy-clf-to-monorepo` |
| Working tree | Mezclado (~132 entradas status; ~186 untracked) |
| Producción | Intacta |
| Inventario | `notifications-etapa-23-change-inventory.md` |

---

## B. Inventario (resumen)

Ver inventory detallado. Núcleo:

- `packages/notifications` + dep `packages/geo`
- Migración 18 + scripts gate
- InfoSpot: lib/notifications, panel, cron, e2e, scripts
- CLF: tracking, prefs, bandeja, `/n/[token]`, join attribution
- Docs `docs/notifications/**`

---

## C. Cambios ajenos

Clickaton, payments, feed InfoSpot, editorial-intelligence, recommendations, sales-assistant.  
**Estrategia:** selección explícita de paths + `git add -p` en mixtos. Nunca `git add .`.

---

## D. Seguridad

| Check | Resultado |
|-------|-----------|
| `.qa-artifacts` / Playwright artifacts | gitignored |
| Secretos cloud en diff notif | No hallados |
| Host staging en docs | Anonimizado `ep-dawn-dew-***` |
| Password QA fixture | Fallback local en `qa-kit.ts` (override env); gate `ALLOW_SEED` |
| Feature flags Production | Default OFF |

---

## E. Migración — estrategia Production

### Situación

- `migrate deploy` global **no** es seguro: migraciones FI/ajenas pendientes en algunos hosts.
- Migración 18 es aditiva e idempotente (`IF NOT EXISTS`).
- Script: `DNX_NOTIFICATIONS_ALLOW_MIGRATE=1` + abort si URL parece `prod-primary`.

### Recomendación

**Opción elegida: script controlado con checksum + registro en `_prisma_migrations` (ya implementado), precedido de checklist de dependencias.**

Secuencia Production (futura, no ejecutar ahora):

1. Inventariar `_prisma_migrations` en prod.
2. Si falta etapa13 (`canProvision` / geo artículos) y el schema client lo exige → aplicar 13 con el mismo patrón gate **o** regularizar cola Prisma en ventana dedicada.
3. Aplicar **solo** `20260723180000_dnx_notifications_engine_etapa18` vía `apply-dnx-notifications-migration.mts`.
4. `check-dnx-notifications-tables` + smoke en staging gemelo.
5. Deploy código con flags OFF.
6. Activar canary (flags) sin `migrate deploy` ciego.

### Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Prisma Client vs DB sin tablas | Deploy solo tras apply 18 |
| Migraciones ajenas bloquean deploy | No usar deploy global |
| Doble apply | Idempotente + check `_prisma_migrations` |

---

## F. Commits propuestos (no ejecutar)

### Commit 1 — Geo dep

```text
feat(geo): add shared geo package for audience selection
```

- `packages/geo/**`
- lock parcial / workspace refs necesarios

### Commit 2 — Core package

```text
feat(notifications): add shared notifications engine
```

- `packages/notifications/**`

### Commit 3 — Database

```text
feat(db): add notification campaigns deliveries and preferences
```

- `schema.prisma` (hunks Dnx* / canNotify)
- `migrations/20260723180000_dnx_notifications_engine_etapa18/**`
- scripts apply/check/smoke
- `infospot-permissions.ts`, `client.ts` exports
- opcional mismo commit o anterior: migration 13 si se versiona junta

### Commit 4 — InfoSpot

```text
feat(infospot): add notification campaign workflow and operations panel
```

- `lib/notifications/**`, actions, admin, cron, panels, vercel.json cron
- wiring usuarios/admin/editar (perms)
- boundary `@repo/db/permissions` donde aplique
- `package.json` hunks notif + playwright
- `turbo.json` env vars notif

### Commit 5 — CLF

```text
feat(compramelafoto): add photographer notification inbox preferences and attribution
```

- `lib/notifications/tracking.ts`, `/n/[token]`, prefs, bandeja, join, navigation

### Commit 6 — QA / e2e

```text
test(notifications): add QA tooling and cross-app browser coverage
```

- e2e/, playwright.config, scripts QA, `.gitignore` artifacts

### Commit 7 — Docs

```text
docs(notifications): add engine runbook release readiness and QA reports
```

- `docs/notifications/**`

### Hunks mixtos

`git add -p` → `apps/infospot/package.json`, `event-editor-form.tsx`, `photographer-call-panel.tsx`, `packages/db/package.json`, `turbo.json`.

---

## G. Variables

Ver `notifications-environment-matrix.md`.

Faltantes Preview (nombres): `DNX_NOTIFICATIONS_EMAIL_OVERRIDE`, `RESEND_API_KEY`.  
Production: flags OFF; no modificar en E23.

---

## H. Cron — estrategia Production

### Recomendación: **Opción A — Vercel Cron en Production**

| Ítem | Valor |
|------|--------|
| Ruta | `/api/cron/notifications-outbox` |
| Schedule | `*/2 * * * *` (ya en `vercel.json`) |
| Auth | `CRON_SECRET` Bearer / `x-cron-secret` |
| Timeout | `maxDuration=60` |
| Batch | query `limit` (default 25, max 100) |
| Locking | lease en delivery |
| Pausa | `DNX_NOTIFICATIONS_CRON_ENABLED=0` → `{paused:true}` |
| Preview | Scheduler Vercel **no** corre; validar HTTP manual |

### Alternativa (B)

Scheduler externo → mismo endpoint autenticado (GitHub Actions / VPS). Usar si Vercel Cron no cumple SLA.

### Activación futura

1. Código + migración + `CRON_SECRET` prod (ya existe — no reutilizar Preview).
2. Flags OFF → deploy.
3. Canary: `ENABLED=1`, `CRON_ENABLED=1`, campaigns limitadas.
4. Observar claimed/sent/failed.

---

## I. Email

Checklist: `notifications-email-activation-checklist.md`.  
Bloqueo: Resend + override Preview.

---

## J. Feature flags (implementados E23)

| Flag | Default prod | Default preview/local |
|------|--------------|------------------------|
| `DNX_NOTIFICATIONS_ENABLED` | OFF | ON |
| `…_CAMPAIGNS_ENABLED` | OFF* | ON |
| `…_CRON_ENABLED` | OFF* | ON |
| `…_EMAIL_ENABLED` | OFF* | ON |

Código: `apps/infospot/lib/notifications/feature-flags.ts`  
Tests: `feature-flags.test.ts` / `test:etapa-23`

Kill switch: master `=0` o ausente en Production.

---

## K. Canary Production (no ejecutar)

| Fase | Alcance | Criterio avanzar | Abortar si |
|------|---------|------------------|------------|
| 0 | Código + migración; flags OFF | Health OK; cron paused/auth | Deploy rompe admin |
| 1 | IN_APP ≤5 staff; sin email; process manual | Attribution/metrics OK | Fallos delivery > umbral |
| 2 | Radio 10 km ≤25; cron ON | Stuck=0; reconcile limpio | Locks/failed spike |
| 3 | EMAIL ≤10 opt-in | Resend OK; 0 bounce crítico | Rebotes/queue stuck |
| 4 | Ampliar límites / editores | 48h estable | Cualquier incidente P1 |

---

## L. Tests (corrida Etapa 23)

| Comando | Resultado |
|---------|-----------|
| `@repo/notifications` test | 23/23 |
| `test:etapa-22` / `test:etapa-23` | OK |
| feature-flags | OK |
| E2E notifications (E22) | 11/11 (referencia) |
| `compramelafoto typecheck` | Fallos **preexistentes** `@repo/payments` (BigInt / exports) — no corregidos |

Ejecutar antes del commit autorizado la batería completa de la Parte 15 del prompt.

---

## M. Simulación post-autorización (NO ejecutar ahora)

```bash
# 1) Stage explícito Commit 1 (ejemplo)
git add packages/geo

# 2) Revisar
git diff --cached --stat

# 3) Commit (solo cuando el usuario autorice)
git commit -m "$(cat <<'EOF'
feat(geo): add shared geo package for audience selection

EOF
)"

# …repetir commits 2–7 con paths del inventory…

# 4) Push SOLO tras autorización
# git push -u origin HEAD

# 5) Esperar Preview InfoSpot + CLF
# 6) DNX_NOTIFICATIONS_ALLOW_MIGRATE=1 apply en DB Preview si falta
# 7) curl cron: 401/401/200 (sin imprimir secreto)
# 8) Flags Preview ON (default); Production no tocar
# 9) E2E:
# INFOSPOT_E2E_BASE_URL=… CLF_E2E_BASE_URL=… pnpm --filter infospot test:e2e:notifications
# 10) Canary IN_APP interno; reconcile; cleanup QA
# 11) NO activar Production cron/email
```

---

## N. Documentación creada/actualizada

- `notifications-etapa-23-change-inventory.md`
- `notifications-environment-matrix.md`
- `notifications-email-activation-checklist.md`
- `notifications-release-rollback.md`
- `notifications-etapa-23-release-readiness-report.md` (este)
- `notifications-operations-runbook.md` (flags + release)

---

## O. Estado final

**LISTO PARA COMMIT CON BLOQUEOS EXTERNOS**

Motivos de “con bloqueos externos” (no impiden commit de código):

1. `RESEND_API_KEY` / override email Preview pendientes (operativo, no de código).
2. Preview permanente requiere push (fuera de esta etapa).
3. Cron scheduler solo en Production (plataforma).
4. Migración Production requiere ventana + checklist hosts (no ejecutar ahora).
5. Working tree sigue mezclado con ajenos — el commit debe ser selección explícita.

Código del motor, flags, docs, inventario y plan de commits están listos para autorización del usuario.
