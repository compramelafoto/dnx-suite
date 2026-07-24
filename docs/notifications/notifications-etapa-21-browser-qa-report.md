# Informe QA — Etapa 21 — Validación browser y activación staging

Fecha: 2026-07-23  
Rama: `migration-legacy-clf-to-monorepo`  
HEAD: `952cf4d` (working tree con cambios Etapa 21)  
Estado final: **APROBADO CON PENDIENTES MANUALES**

---

## A. Preflight

| Ítem | Valor |
|------|-------|
| Repo | `dnx-suite` monorepo |
| Rama | `migration-legacy-clf-to-monorepo` |
| DB | Neon `ep-dawn-dew-***` (staging histórico; no prod-primary) |
| InfoSpot local | `http://127.0.0.1:3004` |
| CLF local | `http://127.0.0.1:3002` (misma `DATABASE_URL` Neon en QA) |
| Staging Vercel | `infospot-dnxsuite` preview healthy; alias git branch |
| Producción | No tocada |
| Commit/push | No |

Variables locales usadas en QA: `CRON_SECRET` temporal en proceso (no en Git).  
`RESEND_API_KEY` / `DNX_NOTIFICATIONS_EMAIL_OVERRIDE`: no configurados → email validado hasta EmailQueue (Etapa 20).

---

## B. Navegadores y entorno

| Pieza | Resultado |
|-------|-----------|
| Playwright 1.51.1 | Configurado en `apps/infospot` |
| Chromium | E2E 8/8 OK |
| Servers | InfoSpot + CLF levantados localmente |
| Kit QA | `notifications:qa-prepare-browser` + storage states |
| Browser smoke | `notifications:browser-smoke` OK (admin, prefs, bandeja, CTA clic) |
| Browser MCP Cursor | No disponible en esta sesión (`ECONNREFUSED :9333`) |

---

## C. Roles y permisos

| Rol | Provisionar | Notificar | Ver métricas | Cancelar | Reintentar | Reconciliar |
|-----|-------------|-----------|--------------|----------|------------|-------------|
| SUPER_ADMIN / Director QA | sí | sí | sí | sí | sí | SUPER_ADMIN |
| Editor ambos | sí | sí | sí (panel) | no | no | no |
| Editor solo provision | sí | no (UI + guard) | no panel ops | no | no | no |
| Sin permisos | no | no | redirect | no | no | no |
| Fotógrafo QA | — | receptor | — | — | — | — |

Evidencia E2E: provision-only ve mensaje de denegación; no_perms no permanece en `/admin/notificaciones`; director/editor_both ven listado.

---

## D. Preview y envío

- Conteos geo: validados en Etapa 20 `qa-flow` (Rosario 10→100 km).
- Envío campaña QA: worker → IN_APP + EmailQueue.
- Panel `/admin/notificaciones` muestra campañas con prefijo `[QA NOTIFICATIONS]`.
- Editor de evento: corrección `defaultLocationValue` (server/client). Preview UI en editor sigue frágil en Turbopack local (`datamodel` intermitente); flujo operativo validado vía panel + smoke + DB.

---

## E. IN_APP

| Check | Resultado |
|-------|-----------|
| Bandeja `/fotografo/notificaciones` | 200 con sesión QA |
| Prefs sin coordenadas | OK |
| CTA `/n/[token]` | Redirect a `/e/qa-notif-rosario-open-…` |
| `clickedAt` / `clickCount` | clickCount=1 tras smoke |
| Token inválido | 404 JSON seguro |
| Dedup worker | Etapa 20 (claimed=0 2.ª pasada) |

---

## F. EMAIL

| Check | Resultado |
|-------|-----------|
| Opt-in → EmailQueue | OK (Etapa 20/21 flow) |
| Override / Resend | **Pendiente** (credenciales no presentes) |
| No envío a usuarios reales | OK (dominio `.invalid` + sin Resend) |

---

## G. Atribución

- Clic CTA validado (métricas delivery).
- Postulación join + cookie: código Etapa 19; **no** se completó postulación UI en esta sesión (pendiente manual corto).
- Casos negativos token: 404.

---

## H. Cron

| Caso | Resultado local |
|------|-----------------|
| Sin secreto | 401 unauthorized |
| Secreto incorrecto | 401 |
| Bearer correcto | 200 ok |
| Header `x-cron-secret` | 200 ok |
| Schedule código | `*/2` en `apps/infospot/vercel.json` |
| `CRON_SECRET` en Vercel preview | **No verificado** (MCP `vercel_validate_staging` falla parseando envs `sensitive`; no se escribió secreto en Git ni en prod) |

Activación staging controlada — checklist operativo:

1. Vercel → proyecto `infospot-dnxsuite` → Environment Preview (no Production).
2. Agregar `CRON_SECRET` (valor distinto de prod).
3. Confirmar cron path `/api/cron/notifications-outbox`.
4. Probe: sin secreto → 401; con secreto → 200.
5. No configurar Production en esta etapa.

---

## I. Panel administrativo

Validado en browser (E2E + smoke): listado, filtros UI presentes, campañas QA visibles, accesos por rol.

---

## J. E2E

```bash
pnpm --filter infospot notifications:qa-prepare-browser
# servers InfoSpot:3004 + CLF:3002 con misma DATABASE_URL
pnpm --filter infospot test:e2e:notifications
```

Resultado: **8 passed** (infospot + clf projects).

---

## K. Tests técnicos

| Comando | Resultado |
|---------|-----------|
| `@repo/notifications` test/check-types | OK (23) |
| `infospot` test:etapa-18…21 | OK |
| `infospot` e2e notifications | 8/8 |
| `compramelafoto typecheck` | Fallos preexistentes `@repo/payments` (no tocados) |

---

## L. Reconciliación

Antes y después del cleanup: dry-run sin locks, sin stuck, sin huérfanos relevantes.

---

## M. Cleanup

- Dry-run: 19 users / 6 events / 2 campaigns / 12 deliveries.
- `--apply`: eliminado.
- Dry-run final: **ceros**.
- Nota: tabla `EventNearbyPhotographerNotification` ausente en host (ignorada).

---

## N. Archivos principales

- `apps/infospot/playwright.config.ts`, `e2e/*`
- `apps/infospot/lib/notifications/qa-browser-roles.ts` (+ DDL aditivo `canProvision…`)
- `apps/infospot/lib/notifications/qa-kit.ts` (bcrypt, URLs locales)
- `apps/infospot/scripts/notifications-qa-prepare-browser.ts`
- `apps/infospot/scripts/notifications-cron-auth-check.ts`
- `apps/infospot/scripts/notifications-browser-smoke.ts`
- `apps/infospot/lib/geolocation/default-location-value.ts` (+ fix imports)
- Docs Etapa 21

---

## O. Pendientes reales

Cerrados o avanzados en **Etapa 22** (ver `notifications-etapa-22-staging-activation-report.md`):

1. ~~Setear `CRON_SECRET` en Vercel Preview~~ → configurado (branch Preview); endpoint validado en deploy local.
2. Resend sandbox + `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` → **sigue pendiente** (sin `RESEND_API_KEY` Preview).
3. ~~Postulación atribuida punta a punta en UI~~ → validada (Playwright + verify DB).
4. ~~Turbopack `datamodel`~~ → boundaries `@repo/db/permissions` / types puros.

Pendiente transversal: **commit/push** del motor (aún untracked en working tree) para Preview permanente.

---

## P. Estado final

**APROBADO CON PENDIENTES MANUALES** (Etapa 21)

Cierre operativo ampliado en Etapa 22.
