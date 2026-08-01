# Resend Webhook — Staging Execution (Imp08)

**Fecha:** 2026-08-01 (UTC-3)
**Implementación:** ETAPA 03 / Imp08
**Responsable ejecución:** agente Cursor + operador (Daniel)
**Estado general:** `BLOCKED` (activación remota no completada)

> **Nota de resolución Imp09 (2026-08-01):** el estado histórico `BLOCKED` de esta evidencia se conserva.
> Recuperación de entorno (identidad, Git, deploy staging, migrate con URL explícita, webhook disabled) documentada en
> [`RESEND_WEBHOOK_STAGING_RECOVERY_IMP09.md`](./RESEND_WEBHOOK_STAGING_RECOVERY_IMP09.md).
> Identidad staging vigente reconciliada: host `ep-round-fog*` / DB `neondb` (fuente: health Vercel `clickaton-staging`).
> `ep-divine-smoke*` / `clickaton_staging` queda como **histórica**. `ep-dawn-dew*` = **DO NOT USE FOR STAGING**.
> Conexión migrate: solo `COMMUNICATIONS_STAGING_DATABASE_URL` (sin fallback a `DATABASE_URL`).
> Deploy staging tip: commit `22bf4ee` / deployment `dpl_D7fYFmTao2TixSZVLuuBKQqqnnLj` — webhook disabled; migrate aún pendiente (ver Imp09).

---

## 1. Matriz de accesos

| Recurso | Acceso | Acción permitida / resultado |
| ------- | ------ | ---------------------------- |
| Vercel `clickaton-staging` | sí (CLI + MCP status) | read / status **PASS**; env prepare MCP **FAIL** (bug enum `sensitive`); write env/deploy **no ejecutado** |
| Neon staging (`ep-round-fog…` vía health) | inspect remoto vía health **PASS**; migrate local **BLOCKED** (URL local ≠ staging) | inspect sí / migrate no |
| Resend dashboard / API webhook | no automatizado en esta sesión | create webhook **BLOCKED — MANUAL** |
| Email smoke autorizado | no verificado en esta sesión | send one **BLOCKED** |
| Commit / push | prohibido por brief | deploy con código Imp06–07 **BLOCKED** |

---

## 2. Producción intacta

| Check | Resultado |
| ----- | --------- |
| No se modificó proyecto `clickaton-dnxsuite` / prod | **PASS** |
| No se aplicó migración a host denylist `ep-dawn-dew` | **PASS** (guard abortó) |
| No se configuraron vars productivas | **PASS** |
| No se desplegó `maratonfotografica.com` | **PASS** |
| No se registró webhook productivo | **PASS** |
| Probe HTTP prod home (solo lectura) | `200` (sin cambios) |

---

## 3. Identidad DB

### Remota (Clickatón staging vivo)

| Campo | Valor sanitizado |
| ----- | ---------------- |
| Health | `https://clickaton-staging.vercel.app/api/public/health/db` → `ok: true` |
| Host hint | `ep-round-fog-a4xgibtv-pooler` |
| publishedEditions | 11 |
| Clasificación | staging (`dnx_staging_identity_host`) |

### Local (shell / `.env`)

| Campo | Valor sanitizado |
| ----- | ---------------- |
| Host | `ep-dawn-dew***` |
| Database | `neondb` |
| Clasificación | **production** (`production_denylist_host_ep_dawn_dew`) |
| Decisión | **DO_NOT_MIGRATE** |

```text
DATABASE IDENTITY (para migrate desde este entorno): FAIL
DATABASE IDENTITY (staging remoto vía health): PASS (inspect only)
```

---

## 4. Backup

```text
BACKUP: BLOCKED
```

Motivo: sin `neonctl` / API Neon en sesión; no se creó branch/restore point.
Política: no migrar sin backup cuando la migración remota esté autorizada.

Restauración manual sugerida (cuando haya acceso Neon):

1. Neon → project de staging → Branches → Create branch `backup-communications-webhook-imp08`
2. Aplicar migrate solo sobre connection string staging verificada
3. Conservar branch ≥ 7 días

---

## 5–7. Migración

| Paso | Resultado |
| ---- | --------- |
| migrate status previo remoto | **SKIPPED** (sin `DATABASE_URL` staging en shell) |
| `communications:migrate:webhook-staging --confirm-staging-migration` | **FAIL/BLOCKED** — identity production denylist |
| Migración aplicada | **NO** |
| Tabla `DnxCommunicationWebhookEvent` en staging | **UNKNOWN** (no inspect SQL remoto) |
| Unique constraint smoke remoto | **SKIPPED** |

Evidencia guard:

```json
{"status":"NOT_READY","reason":"identity_guard_failed","detail":"production_database_blocked:production_denylist_host_ep_dawn_dew"}
```

---

## 8. Variables Vercel staging

Inspección `vercel env ls` (nombres, sin valores):

| Variable | Presente | Scope observado |
| -------- | -------: | --------------- |
| `DATABASE_URL` | sí | Production + Preview |
| `DIRECT_URL` | sí | Production + Preview |
| `DNX_PAYMENTS_WEBHOOK_*` | sí | (payments) |
| `COMMUNICATIONS_RESEND_WEBHOOK_ENABLED` | **no** | — |
| `COMMUNICATIONS_WEBHOOK_MODE` | **no** | — |
| `RESEND_WEBHOOK_SECRET` | **no** | — |
| `COMMUNICATIONS_WEBHOOK_ALLOWED_EVENTS` | **no** | — |

```text
STAGING VARS FOR COMMUNICATIONS WEBHOOK: NOT CONFIGURED
```

No se escribieron variables remotas en esta implementación.

---

## 9–10. Deploy

| Item | Valor |
| ---- | ----- |
| Proyecto | `clickaton-staging` |
| Deployment observado (alias) | `dpl_DvPjVvcZB8DczZBLMbrdtAmHvKL9` |
| Last deploy / build | `dpl_ERNqHHP4NM4RQJiASz4J62ruSoXF` READY |
| Commit en deploy | `74368f1` |
| Código Imp06–07 webhook en working tree | **sí (local, no committed)** |
| Deploy Imp08 ejecutado | **NO / BLOCKED** (requiere commit/push o deploy con working tree; brief prohíbe commit/push) |

---

## 11. Endpoint remoto

| Probe | HTTP | Evidencia |
| ----- | ---: | --------- |
| `GET /api/webhooks/resend` | **404** HTML Next | ruta aún no en deployment vivo |
| `POST` sin firma | **404** HTML | idem |
| Health DB público | **200** | DB reachable |

Interpretación: el endpoint Imp06/07 **no está desplegado** todavía. Un 404 actual es coherente con código solo local.

---

## 12. Readiness remoto

```text
READYNESS REMOTO: BLOCKED / NOT RUN
```

Motivo: sin `DATABASE_URL` staging + sin deploy del código + vars ausentes.

Readiness local conceptual (fase A): código default `enabled=false` → no recepción.

---

## 13. Webhook Resend

```text
WEBHOOK REGISTRATION: BLOCKED — MANUAL ACTION REQUIRED
```

Pasos exactos (cuando exista deploy + vars):

1. Confirmar `POST /api/webhooks/resend` responde 503/401 (no 404)
2. Readiness `READY` con Fase C
3. Resend → Webhooks → **DNX Communications — Clickaton Staging**
4. URL: `https://clickaton-staging.vercel.app/api/webhooks/resend`
5. Eventos: solo técnicos (7). **Sin** opened/clicked
6. Copiar signing secret → Vercel staging `RESEND_WEBHOOK_SECRET`
7. Set:

```env
COMMUNICATIONS_RESEND_WEBHOOK_ENABLED=true
COMMUNICATIONS_WEBHOOK_MODE=verify_only
COMMUNICATIONS_WEBHOOK_ENVIRONMENT=staging
COMMUNICATIONS_WEBHOOK_ALLOWED_EVENTS=email.sent,email.delivered,email.delivery_delayed,email.bounced,email.complained,email.failed,email.suppressed
COMMUNICATIONS_WEBHOOK_PERSIST_BEHAVIORAL_EVENTS=false
```

8. Redeploy staging
9. Smoke un email

Webhook ID: n/a
Eventos seleccionados: n/a
Opened/clicked excluidos en dashboard: n/a (no creado)

---

## 14–17. Smoke email / recepción / dedupe

| Paso | Resultado |
| ---- | --------- |
| Remitente verificado | **SKIPPED** |
| Destinatario autorizado | **SKIPPED** |
| Envío smoke live | **BLOCKED** |
| Provider message ID | n/a |
| Evento recibido | **BLOCKED** |
| Persistido verified | **BLOCKED** |
| Dedupe real Resend | **SKIPPED** |
| Opened/clicked server-side (tests locales) | **PASS** |

---

## 18. Validaciones locales ejecutadas

| Check | Resultado |
| ----- | --------- |
| `@repo/communications` tests | **PASS** 80/80 |
| Clickatón webhook + readiness tests | **PASS** 22/22 |
| classify-smoke-db tests | **PASS** 8/8 (incluye denylist dawn-dew) |
| typecheck communications | **PASS** |
| lint communications | **PASS** |
| prisma validate | **PASS** |

---

## 19. Logs / alertas

No hubo tráfico webhook real. Alert sink permanece noop/disabled.
Sanitización cubierta por tests locales previos.

---

## 20. Estado final staging

```text
STAGING DISABLED (de facto para Communications webhook)
```

- Endpoint webhook: **404** (no desplegado)
- Vars Communications: **ausentes**
- Migración Communications: **no aplicada** (desde este entorno)
- Webhook Resend: **no registrado**
- Producción: **intacta**

Decisión explícita Imp08:

```text
STAGING LEFT IN PRE-ACTIVATION / DISABLED FOR COMMUNICATIONS WEBHOOK
```

No se dejó `mode=process`. No se dejó secret faltante con endpoint activo (endpoint ni siquiera existe en deploy).

---

## 21. Rollback readiness

Procedimiento (probado conceptualmente / local Imp07):

```env
COMMUNICATIONS_RESEND_WEBHOOK_ENABLED=false
COMMUNICATIONS_WEBHOOK_MODE=disabled
```

→ redeploy → HTTP 404
→ no borrar tabla
→ deshabilitar webhook en Resend si existiera

```text
ROLLBACK READINESS: PASS (documentado; no ejecutado remotamente porque no hubo activación)
```

---

## 22. Mejoras aplicadas en Imp08 (código)

- Denylist explícita `ep-dawn-dew` → classification `production` en `classify-smoke-database-url.ts`
- Migrate guard refuerza bloqueo de hosts productivos
- Test unitario del denylist

---

## 23. Riesgos / deuda

1. Código Imp06–07 aún no committed/pushed → no deployable sin autorización git.
2. Local `.env` apunta a host productivo denylist — riesgo operativo alto si se ignora el guard.
3. Doc histórica `ep-divine-smoke` / `clickaton_staging` vs health vivo `ep-round-fog` — alinear identidad esperada antes de migrate.
4. MCP `vercel_prepare_staging` falla por enum `sensitive`.
5. Rate limit durable sigue pendiente.

---

## 24. Legal

| Escenario | Estado |
| --------- | ------ |
| Esta sesión (sin recolección remota) | Preparación técnica; smoke no ejecutado |
| Antes de activar staging con datos | `LEGAL REVIEW RECOMMENDED BEFORE STAGING DATA COLLECTION` |
| Opens/clicks productivos | `LEGAL REVIEW REQUIRED BEFORE PRODUCTION` |

---

## 25. Acciones manuales pendientes (orden)

1. Proveer `DATABASE_URL` / `DIRECT_URL` de staging (host `ep-round-fog…` o el canónico acordado) **sin** usar `ep-dawn-dew`.
2. Crear backup Neon `backup-communications-webhook-imp08`.
3. Autorizar **commit + push** del código Imp06–07 (o deploy desde working tree si se autoriza excepcionalmente).
4. `pnpm --filter @repo/db communications:migrate:webhook-staging -- --confirm-staging-migration`
5. Configurar vars Communications en Vercel `clickaton-staging`.
6. Deploy staging.
7. Verificar `POST /api/webhooks/resend` ≠ 404.
8. Registrar webhook en Resend (solo 7 eventos técnicos).
9. Un smoke `system.test` autorizado.
10. `communications:webhook:recent` + readiness final.

---

## 26. Comandos exactos (cuando se desbloquee)

```bash
# Identity + migrate (Imp09: URL explícita — NO usar DATABASE_URL local)
# DO NOT USE CURRENT LOCAL DATABASE_URL FOR STAGING MIGRATIONS
export COMMUNICATIONS_STAGING_DATABASE_URL="…staging ep-round-fog…"
export COMMUNICATIONS_EXPECTED_DATABASE_ENV=staging
export COMMUNICATIONS_EXPECTED_HOST_PREFIX=ep-round-fog
export COMMUNICATIONS_EXPECTED_DATABASE_NAME=neondb
pnpm --filter @repo/db communications:db:identity
pnpm --filter @repo/db communications:migrate:webhook-staging -- --confirm-staging-migration

pnpm --filter clickaton communications:webhook:readiness

# Tras deploy + secret Resend (Imp10 — no Imp08/09):
pnpm --filter @repo/communications smoke:resend -- \
  --to AUTORIZADO --template system.test --brand clickaton --confirm-live-send
pnpm --filter clickaton communications:webhook:recent -- --limit 20
```
