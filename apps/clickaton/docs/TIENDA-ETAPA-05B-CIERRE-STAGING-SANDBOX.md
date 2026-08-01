# TIENDA — Etapa 05B — Cierre técnico, migración staging y validación sandbox

**Estado de esta etapa: BLOCKED** (bloqueo externo de credenciales / identidad DB staging).

**Palabra clave:** TIENDA  
**ACCIÓN LEGAL REQUERIDA ANTES DE PRODUCCIÓN.**

No commits / no push / no deploy a producción / no migración en producción.

---

## 1. Entorno auditado

| Campo | Valor |
|-------|--------|
| Proyecto Vercel staging | `clickaton-staging` (`prj_MM6Bkdi8WDDH5P7D5qk66nUFsroa`) |
| URL | `https://clickaton-staging.vercel.app` |
| Branch esperada | `migration-legacy-clf-to-monorepo` |
| Base efectiva (health) | host hint `ep-round-fog-a4xgibtv-pooler`, db `neondb`, `publishedEditions: 12` |
| Proyecto producción | `clickaton-dnxsuite` / `maratonfotografica.com` — **no tocado** |
| Denylist prod DB | `ep-dawn-dew***` (presente en `packages/db/.env` local) |

### Aislamiento confirmado

- Health staging → `ep-round-fog` (no `ep-dawn-dew`).
- Local `DATABASE_URL` clasificado como **production** (`production_denylist_host_ep_dawn_dew`) → **rechazado** para migrate.
- Script de migrate TIENDA **no hace fallback** a `DATABASE_URL`.
- `/tienda/checkout` en producción web → `404` (sin superficie de checkout store).
- No se ejecutó deploy ni migrate contra producción.

### Probes HTTP (evidencia)

| URL | HTTP |
|-----|------|
| staging `/api/public/health/db` | 200, host `ep-round-fog…` |
| staging `/tienda` | 200 |
| staging `/tienda/carrito` | 200 |
| staging `/tienda/checkout` | **404** (código Etapa 05 aún no desplegado) |
| prod `/tienda/checkout` | 404 |

### DNX Payments / MP (staging Vercel — nombres)

Presentes en proyecto `clickaton-staging` (valores Sensitive; no descargables por `vercel env pull`):

- `CLICKATON_DNX_PAYMENTS_PROVIDER` (pull mostró `mercado_pago_test` en intento previo)
- `MERCADOPAGO_TEST_ACCESS_TOKEN` / `MERCADOPAGO_TEST_PUBLIC_KEY`
- `MERCADOPAGO_CREDENTIALS_SOURCE=credenciales_de_prueba`
- `DNX_PAYMENTS_WEBHOOK_PUBLIC_URL` / `DNX_PAYMENTS_WEBHOOK_SECRET`
- `CRON_SECRET` / `CLICKATON_CRON_SECRET`

Flags TIENDA añadidas en Production del proyecto staging (≈10 min antes del cierre de auditoría):

- `CLICKATON_STORE_CHECKOUT_ENABLED`
- `CLICKATON_STORE_PAYMENTS_LIVE`
- `STORE_HOLD_TTL_MINUTES`

**Valores no legibles** vía CLI (tipo Sensitive → pull vacío). No se puede afirmar en esta sesión si checkout quedó `true` en staging.

---

## 2. Auditoría de migración

**Archivo:** `packages/db/prisma/migrations/20260802010000_clickaton_store_orders/migration.sql`

| Check | Resultado |
|-------|-----------|
| SQL destructivo (`DROP`/`TRUNCATE`/`DELETE`) | **No** |
| Enums store order/payment/hold/delivery | Sí |
| Tablas `ClickatonStoreOrder`, `Item`, `StockHold` | Sí |
| Unique `publicId`, `clientIdempotencyKey`, `paymentIdempotencyKey` | Sí |
| Índices status/holdExpiresAt/paymentOrderId/email | Sí |
| FK items/holds → order `ON DELETE RESTRICT` | Sí |
| No altera inscripción / DNX payments existentes | Sí |
| `prisma validate` | OK (warning preexistente SetNull ajeno) |

---

## 3. Backup staging

**No ejecutado.**

Motivos:

1. No hay `CLICKATON_STAGING_DATABASE_URL` / `COMMUNICATIONS_STAGING_DATABASE_URL` en el entorno del agente.
2. `vercel env pull` **no descarga** `DATABASE_URL` Sensitive (queda vacío).
3. Neon CLI/neonctl requiere selección interactiva de org — no usable de forma no interactiva aquí.

**Estrategia documentada (obligatoria antes de migrate):**

1. En Neon (proyecto del host `ep-round-fog`): crear **branch** de recuperación, p. ej. `tienda-05b-backup-YYYYMMDD-HHMM`.
2. Registrar branch id + timestamp.
3. Solo entonces correr migrate con URL staging explícita.

---

## 4. Aplicación de migración

**No aplicada.**

Comando canónico preparado (sin fallback a `.env` local):

```bash
# Tras backup Neon branch
export CLICKATON_STAGING_DATABASE_URL="postgresql://…@ep-round-fog…/neondb…"
export CLICKATON_EXPECTED_DATABASE_ENV=staging
export CLICKATON_EXPECTED_HOST_PREFIX=ep-round-fog
export CLICKATON_EXPECTED_DATABASE_NAME=neondb

pnpm --filter @repo/db store:migrate:staging -- --confirm-staging-migration
```

Evidencia dry-run en esta sesión:

```json
{"status":"NOT_READY","reason":"STAGING_DATABASE_URL_absent"}
```

Local DB classification:

```json
{"localDbClassification":"production","safeForTestSmoke":false,"reason":"production_denylist_host_ep_dawn_dew"}
```

**Producción intacta:** no se invocó `migrate deploy` contra ninguna URL.

---

## 5. Variables staging vs producción

| Variable | Staging (deseado) | Producción web |
|----------|-------------------|----------------|
| `CLICKATON_STORE_CHECKOUT_ENABLED` | `true` solo tras migrate+deploy | **false / ausente** |
| `CLICKATON_STORE_PAYMENTS_LIVE` | `false` | **false / ausente** |
| `STORE_HOLD_TTL_MINUTES` | `15` (o reducido temporal para cron) | n/a / false path |
| Provider MP | `mercado_pago_test` | no live tienda |

Keys existen en Vercel staging Production; **valores no verificables** por Sensitive pull.

---

## 6. Datos de prueba / deploy / sandbox

| Paso | Estado |
|------|--------|
| Producto store ACTIVE en staging | No preparado en esta sesión |
| Deploy código Etapa 05 a staging | **No** (checkout 404; sin commit/push; sin `deploy:staging:safe`) |
| Compra MP sandbox aprobada | **No ejecutada** |
| Webhook real sandbox | **No ejecutado** |
| Casos rechazado/pendiente/abandono/expiración/reintento/duplicado/concurrencia | **No ejecutados** |
| Cron expire-store-holds en staging | **No ejecutado** |
| Rollback flag OFF en staging vivo | **No ejecutado** (código checkout ausente) |

---

## 7. Rate limit

- Solución actual TIENDA: in-memory (`lib/public-store/checkout/rate-limit.ts`) + tope de órdenes pendientes por email.
- Inscripción: mismo patrón documentado (Redis durable pendiente en docs 10D3F-B).
- **No** hay Upstash/Redis canónico reutilizable en Clickatón para este endpoint.
- **Producción permanece bloqueada** también por rate limit no durable + legal + flags OFF.

---

## 8. Validaciones locales (sí ejecutadas)

| Check | Resultado |
|-------|-----------|
| `prisma validate` | OK |
| `test:public-store` | **47 pass** |
| `npm run build` (clickaton) | **FAIL** typecheck preexistente en `lib/admin/partners/prisma-partners-adapter.ts` (PartnersRepository incompleto). **No es regresión TIENDA** (sin refs a store/checkout). |
| Script `store:migrate:staging` | NOT_READY (URL ausente) — correcto |
| Lint amplio | no como gate de esta sesión |
| Smoke staging compra | bloqueado |

---

## 9. Observabilidad

Código Etapa 05 emite eventos `store_*` sin PII completa. **No verificado en runtime staging** (código no desplegado).

---

## 10. Acción legal

**SÍ REQUIERE ACCIÓN LEGAL ANTES DE PRODUCCIÓN.**

Pendientes: términos de compra, cambios/devoluciones, entrega/retiro, privacidad, datos personales, ID fiscal, plazos, personalizados, disponibilidad, cancelación, pagos rechazados/duplicados.

---

## 11. Bloqueo externo preciso (desbloqueo)

Para salir de BLOCKED, un operador con acceso debe:

1. **Exportar** connection string staging `ep-round-fog` / `neondb` a  
   `CLICKATON_STAGING_DATABASE_URL` (nunca pegar en chat/git).
2. **Crear Neon branch backup** y anotar id/timestamp.
3. Ejecutar `pnpm --filter @repo/db store:migrate:staging -- --confirm-staging-migration`.
4. Verificar tablas store con query de lectura.
5. Confirmar en Vercel staging:  
   `CLICKATON_STORE_CHECKOUT_ENABLED=true`,  
   `CLICKATON_STORE_PAYMENTS_LIVE=false`,  
   provider TEST, webhook/cron secrets.
6. Deploy staging autorizado:  
   `pnpm --filter clickaton deploy:staging:safe -- --confirm-staging-deploy`  
   (incluye código Etapa 05 local; sin push a prod).
7. Seed producto tienda + collector sandbox.
8. Ejecutar compra sandbox aprobada + webhook + matriz de casos 05B.
9. Actualizar este doc a DONE o DONE WITH WARNINGS.

---

## 12. Riesgos restantes

1. URL staging no disponible al agente (Sensitive Vercel).
2. Código checkout no en alias staging (404).
3. Último deploy staging reportado ERROR en snapshot Vercel previo (revalidar antes de redeploy).
4. Rate limit no durable.
5. Legal bloquea producción.
6. Flags staging Sensitive — valores no auditables por CLI.
7. Backup Neon no creado aún.

---

## 13. Artefactos de esta etapa 05B

- `packages/db/scripts/store-migrate-staging.mts` (nuevo)
- `packages/db/package.json` — script `store:migrate:staging`
- Este documento
