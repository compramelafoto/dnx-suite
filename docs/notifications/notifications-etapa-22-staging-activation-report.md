# Etapa 22 — Cierre staging: cron, email, atribución UI y Turbopack

Fecha: 2026-07-23  
Rama: `migration-legacy-clf-to-monorepo`  
Commit local HEAD (referencia): `1b2de05`  
Producción: **no tocada**  
Commit/push: **no realizados** (por instrucción de etapa)

---

## A. Preflight

| Ítem | Resultado |
|------|-----------|
| Repo | `dnx-suite` |
| Rama | `migration-legacy-clf-to-monorepo` |
| Proyecto Vercel Preview | `infospot-dnxsuite` (team `compramelafotos-projects`) |
| Dominio Preview (anonimizado) | `infospot-dnxsuite-*.vercel.app` + alias git branch |
| DB | Neon staging `ep-dawn-dew-***` (no producción) |
| QA residual inicial | ceros (Etapa 21) |

**Hallazgo crítico de git:** el motor de notificaciones (`packages/notifications`, `apps/infospot/lib/notifications/**`, ruta cron, docs) está **untracked / no presente en HEAD remoto**. El deploy Preview ligado al alias git de la rama **no** incluía `/api/cron/notifications-outbox` hasta un deploy local explícito.

---

## B. Cron de notificaciones

| Ítem | Resultado |
|------|-----------|
| Ruta | `/api/cron/notifications-outbox` |
| Schedule (`vercel.json` working tree) | `*/2 * * * *` |
| `CRON_SECRET` Preview (rama) | **Configurado** (Encrypted, solo Preview + branch; Production intacta) |
| Redeploy / deploy local Preview | Sí — URL efímera con la ruta incluida |
| Sin auth | `401 unauthorized` |
| Secreto incorrecto | `401` |
| Secreto válido | `200` `{ ok: true, claimed, sent, … }` |
| Concurrente (2×) | `200` ambos; outbox vacío `claimed=0` |
| Cron scheduler Vercel en Preview | **No ejecuta** (limitación de plataforma: crons solo Production) |

Validación del endpoint autenticado = simulación del payload que invocaría el scheduler. **No** se marca “cron real de plataforma en Preview” porque Vercel no dispara crons fuera de Production.

Pasos manuales si hace falta rotar:

1. Vercel → Project `infospot-dnxsuite` → Settings → Environment Variables  
2. `CRON_SECRET` · Environment **Preview** · Git Branch `migration-legacy-clf-to-monorepo`  
3. Redeploy Preview (no Production)

---

## C. Canal EMAIL

| Ítem | Resultado |
|------|-----------|
| Opt-in | Requiere `nearbyPhotographerCalls` + `channelEmail` |
| Override | `resolveNotificationEmailTo` — activo en no-producción **y** `VERCEL_ENV=preview` aunque `NODE_ENV=production` |
| Producción | Override ignorado (fail-safe + log) |
| `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` Preview | **No configurado** |
| `RESEND_API_KEY` Preview InfoSpot / CLF | **Ausente** |
| Validación máxima | Hasta `EmailQueue` (Etapas 20–21); **sin envío Resend real** |

Cron email CLF: `apps/compramelafoto/vercel.json` → `/api/cron/process-email-queue` (`*/1`), auth `CRON_SECRET` del proyecto CLF Preview (ya existía).

---

## D. Atribución desde UI

Flujo validado:

```text
IN_APP SENT → GET /n/[token] → cookie dnx_notif_attr → /e/[shareSlug]
→ checkbox términos → Inscribirme → EventMember → DnxNotificationAttribution
→ applicationCount = 1 (metrics match)
```

| Caso | Resultado |
|------|-----------|
| CTA + join UI | OK (Playwright + `notifications:qa-verify-attribution`) |
| Idempotencia re-submit | OK (unique delivery / catch) |
| Token inválido | OK (&lt;500) |
| Acceso directo sin CTA | Página carga; no fuerza attribution |
| Cookie | httpOnly, SameSite=Lax, `expiresAt`, Secure en HTTPS/preview |

Scripts: `notifications:qa-prepare-attribution`, `notifications:qa-verify-attribution`.

---

## E. Turbopack / preview editor

| Ítem | Detalle |
|-------|---------|
| Error | Intermitente `Prisma.dmmf.datamodel` al cargar módulos en cliente |
| Causa | Client Components / adaptadores importaban barrel `@repo/db` → `client.ts` evalúa `Prisma.dmmf` |
| Fix | Export `@repo/db/permissions` y `@repo/db/clf-album-availability`; adapters + components client migrados |
| Test contrato | `etapa-22-contract.test.ts` (boundaries de import) |

---

## F. Preview integrado (cron real de plataforma)

| Paso | Estado |
|------|--------|
| Endpoint auth Preview | Validado (deploy local con código untracked) |
| Scheduler Vercel Preview | **Bloqueado por plataforma** |
| Campaña QA solo vía cron scheduler | No aplicable en Preview |
| Procesamiento autenticado HTTP | Validado (equivalente a invocación cron) |

---

## G. Tests E2E

| Suite | Resultado |
|-------|-----------|
| InfoSpot permisos/panel | 5/5 |
| CLF prefs/bandeja/token | 3/3 |
| Atribución UI | 3/3 (incluye CTA→join) |
| Preview E2E remoto CLF+InfoSpot | No ejecutado end-to-end (falta CLF Preview alineado + seed; flag `INFOSPOT_E2E_BASE_URL` / `CLF_E2E_BASE_URL` documentado) |

---

## H. Reconciliación

Dry-run final: todos los contadores de atribución/locks/mismatch en **0**.

Campos nuevos: attribution huérfana, delivery de otra campaña, user mismatch, `applicationCount` mismatch, candidatos click+member sin attribution (sin auto-crear).

---

## I. Cleanup

| Paso | Resultado |
|------|-----------|
| Dry-run | Detectó residuales post-UI (Album FK) |
| Apply | OK tras borrar `Album`/`Photo` de usuarios QA |
| Dry-run final | **ceros** |
| Reconcile | limpio |

---

## J. Tests técnicos

| Comando | Resultado |
|---------|-----------|
| `pnpm --filter @repo/notifications test` | 23/23 |
| `check-types` / `lint` notifications | OK |
| `pnpm --filter infospot test:etapa-22` | OK |
| `pnpm --filter infospot check-types` | OK |
| E2E local notificaciones | 11/11 (5+6) |
| `compramelafoto typecheck` | Ver corrida adjunta; fallos `@repo/payments` preexistentes no corregidos |

---

## K. Variables pendientes (solo nombres)

| Variable | Entorno | Estado |
|----------|---------|--------|
| `CRON_SECRET` | InfoSpot Preview (branch) | Configurado |
| `CRON_SECRET` | InfoSpot Production | Existente (no modificado) |
| `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` | Preview | Pendiente |
| `RESEND_API_KEY` | Preview (InfoSpot/CLF según worker email) | Pendiente |

---

## L. Archivos tocados (principales)

- `packages/db/package.json` (exports permissions / clf-album-availability)
- `apps/infospot/lib/editorial/{event,article}-adapter.ts`
- `apps/infospot/components/redaccion/*`, `components/editorial/article-view.tsx`, `components/public/album-commerce-cta.tsx`
- `apps/infospot/lib/notifications/{email-override,metrics,reconcile,worker,qa-kit}.ts` + tests Etapa 22
- `apps/infospot/app/admin/notificaciones/[id]/page.tsx`
- `apps/infospot/e2e/notifications-attribution.spec.ts`, `playwright.config.ts`, `package.json` scripts
- `apps/infospot/scripts/notifications-qa-prepare-attribution.ts`, `notifications-qa-verify-attribution.ts`
- `apps/compramelafoto/lib/notifications/tracking.ts`
- Docs: este informe + updates runbook/engine/etapa-21

---

## M. Pendientes reales

1. **Commit + push** del motor de notificaciones (hoy untracked) para que el alias Preview permanente incluya cron/ruta.  
2. `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` + `RESEND_API_KEY` sandbox en Preview (sin Production).  
3. Cron scheduler automático solo disponible en **Production** Vercel — activación productiva posterior controlada.  
4. E2E remoto Preview CLF+InfoSpot con usuarios QA (opcional; flags ya soportados).

---

## N. Estado final

**APROBADO CON PENDIENTES MANUALES**

Motivos que impiden **APROBADO** estricto del prompt:

- El código del motor no está en el HEAD remoto (requiere commit/push fuera de esta etapa).  
- No hay cron scheduler real de Vercel en Preview (limitación de plataforma).  
- Resend / override no validados con envío real.  
- Production no tocada; sin commit/push — correcto por instrucción.
