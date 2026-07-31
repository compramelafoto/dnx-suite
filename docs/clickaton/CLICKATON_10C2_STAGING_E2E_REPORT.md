# Clickatón — ETAPA 10C.2 — Staging migrate / seed AR2026 / E2E MP TEST

**Fecha:** 2026-07-30  
**Branch:** `migration-legacy-clf-to-monorepo`  
**HEAD local (código ops):** incluye classifier `ep-round-fog` + smoke execute (consent/foto/finance)  
**Production Clickatón (`clickaton-dnxsuite` / maratonfotografica.com):** no tocada  
**Mercado Pago LIVE:** no tocada  

---

## Veredicto

```text
CLICKATON E2E PAYMENT TEST BLOCKED
```

**No** se declara `CLICKATON REGISTRATION + CHECKOUT READY IN STAGING` porque el pago TEST no llegó a `APPROVED` / `CONFIRMED`.

Sí quedaron cerrados (evidencia abajo):

1. DB Staging confirmada `ep-round-fog…` / `neondb`
2. Backup Neon pre-migración
3. `prisma migrate deploy` (nullable `userId`)
4. Seed + enable AR2026 con Remera `stockLimit=100`
5. Redeploy Staging + ruta maratón **HTTP 200**
6. Guest reserva real AR2026 (`userId=null`, merch fase 1, `$25.000`)
7. Preferencia Checkout Pro TEST creada (orden DNX + redirect MP)
8. Selfchecks first-N / guest / reservation / funnel / payments(manual) / typecheck

---

## 1. DB Staging

| Campo | Valor sanitizado |
| ----- | ---------------- |
| Host | `ep-round-fog-a4xgibtv-pooler…` |
| DB | `neondb` |
| Neon project | `fragrant-union-80829821` (dnx-suite-staging) |
| Health alias | `https://clickaton-staging.vercel.app/api/public/health/db` → `ok:true` |
| ¿Production? | **No** |

**Hallazgo ops:** `DATABASE_URL` / `DIRECT_URL` estaban solo en target Production del proyecto Vercel `clickaton-staging` y el runtime del alias fallaba con `Environment variable not found: DATABASE_URL`. Se re-setearon a `ep-round-fog` y se agregaron también a Preview de la branch `migration-legacy-clf-to-monorepo`.

---

## 2. Backup pre-migración

| Campo | Valor |
| ----- | ----- |
| Project | `fragrant-union-80829821` |
| Branch | `backup-before-10c2-registration-migration` |
| Branch id | `br-late-hill-a4a8shoo` |
| Endpoint backup | `ep-purple-thunder-a461s059…` |
| Created At (UTC) | `2026-07-30T06:29:16Z` |
| State | `ready` |

---

## 3–4. Prisma migrate

Contra `ep-round-fog…` / `neondb` (vía `DIRECT_URL` local CLF preview + override; **no** `db push`):

| Paso | Resultado |
| ---- | --------- |
| `migrate status` (antes) | 1 pendiente: `20260730060000_clickaton_registration_guest_nullable_userid` |
| `migrate deploy` | aplicada |
| `migrate status` (después) | **Database schema is up to date** |
| Drift crítico | no |

Post-check: `ClickatonRegistration.userId` → `is_nullable=YES`; `ClickatonPricePhaseItem.stockLimit` presente.

---

## 5–7. Seed / config AR2026

- Auditoría previa: slug `clickaton-argentina-2026` **ausente** (solo ediciones smoke).
- Seed idempotente: `CLICKATON_SEED_ARGENTINA_2026=1 pnpm --filter clickaton seed:argentina-2026` → `ok`.
- Enable Staging (ops, no Production):
  - `status=REGISTRATION_OPEN`, `isPublished=true`, `registrationEnabled=true`
  - Fase 1 `startsAt` adelantada a `2026-07-15` (seed canónico arrancaba `2026-08-01`; hoy 2026-07-30 quedaba sin fase activa)
- Remera fase 1: `stockLimit=100` (beneficio; `phase.capacity=null`)
- Ticket GENERAL: `$25.000`, capacity `null`
- Variantes talle: 7
- Finance TEST bootstrap (acuerdo ACTIVE + versión PUBLISHED + PaymentAccount vaulted TEST): script nuevo `scripts/lib/seed-staging-test-finance.ts`

---

## 8. Redeploy Staging

| Campo | Valor |
| ----- | ----- |
| Proyecto Vercel | `clickaton-staging` (target production = alias staging) |
| Deploy final health | `dpl_6Se2tZzjM7WP39u9wcdDDEmEoPTQ` |
| Alias | `https://clickaton-staging.vercel.app` |
| Commit base deploy | `fca196b` (+ cambios locales classifier/smoke/finance aún no necesariamente committeados) |

También se rotó/asegó en Staging: `DNX_PAYMENTS_WEBHOOK_SECRET`, URLs públicas, `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY(_TEST)`.

---

## 9. Smoke ruta

| Ruta | HTTP |
| ---- | ---- |
| `/maratones/clickaton-argentina-2026` | **200** |
| Health DB | `ok:true`, host `ep-round-fog…`, publishedEditions ≥ 7 |
| CTA | Inscribirme visible |

---

## 10. Guest form / reserva (sin User)

Creación controlada contra AR2026 (service + Prisma Staging):

| Campo | Resultado |
| ----- | --------- |
| status | `PENDING_PAYMENT` |
| paymentStatus | `PENDING` |
| userId | `null` (guest) |
| total | `$25.000` ARS |
| fase | Primera etapa |
| merch Remera | presente (`stockLimit=100`) |

No se creó User DNX en este paso.

---

## 11–12. Mercado Pago TEST / webhook

### Lo logrado

| Paso | Evidencia sanitizada |
| ---- | -------------------- |
| Registration smoke | `cms75h…7wmg` |
| Order DNX | `dnx_ord_…42d2` |
| Checkout host | `www.mercadopago.com.ar` |
| Preference | `3141372692-5dc4d652-…174fd4` |
| Amount | `1500` minor / ARS |
| Seller | TESTUSER `3141…` / `@testuser.com` / MLA |
| Provider mode | `mercado_pago_test` |
| check-config smoke | all green (tras classifier `ep-round-fog`) |

### Bloqueo APPROVED

| Canal | Resultado |
| ----- | --------- |
| Payments API (`/v1/payments`) | **HTTP 401** `Unauthorized use of live credentials` (code 7) pese a seller `test_user` |
| Checkout Pro UI headless | página crawler / captcha |
| Checkout Pro UI headed | tarjeta antigua `5031755734560604` falla Luhn; otras cards o “no podés pagar” o Continuar no avanza en secure-fields |

**Webhook:** no se pudo validar ingest APPROVED porque no hubo pago acreditado. Notification URL de la preferencia apunta a `clickaton-staging.vercel.app`.

---

## 13 / 21. First-N

| Check | Resultado |
| ----- | --------- |
| `selfcheck:first-n-benefit` | OK |
| Config Staging Remera | `stockLimit=100` |
| Capacidad fase | `null` (N+1 puede inscribirse) |
| Guest AR2026 con merch | OK (dentro de cupo) |

No se consumieron 100 pagos reales.

---

## 14–20. Activación / Google / QR / email / FotoRank / admin

**No ejecutados end-to-end** (dependen de `CONFIRMED` post-pago).

Código/ruta de activación permanece listo desde 10C.1 (`/activar`, flags `pago/exito`).

---

## 22. CI (local, filtro clickaton)

| Check | Exit |
| ----- | ---- |
| first-n-benefit | 0 |
| guest-registration-identity | 0 |
| public-registration-reservation | 0 |
| public-registration-hardening | 0 |
| registration-funnel-11b | 0 |
| dnx-payments-checkout (provider manual) | 0 |
| dnx-payments-smoke (provider manual) | 0 |
| smoke-db-classify (+ host round-fog) | 0 |
| check-types | 0 |
| smoke execute MP → APPROVED | **FAIL / BLOCKED** |

Nota: con `CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_test` en el shell, los selfchecks in-memory de payments requieren distribución ACTIVE (comportamiento real de checkout). Correrlos con `manual` o bootstrapping finance por edición.

---

## 24. Legal

```text
LEGAL REVIEW REQUIRED
```

No bloquea más trabajo técnico de Staging; sí GO/NO-GO Production.

---

## Desbloqueo para READY

1. Completar pago Checkout Pro TEST **manual** (o buyer TEST controlado) sobre preferencia/staging con tarjeta oficial vigente (evitar `5031755734560604` — Luhn false).
2. Confirmar webhook/S2S → `CONFIRMED` + idempotencia.
3. Correr activación User nuevo / existente / Google-only.
4. Redeploy con commits de classifier + smoke execute + finance bootstrap.
5. Re-declarar veredicto `CLICKATON REGISTRATION + CHECKOUT READY IN STAGING`.

---

## Artefactos ops (no secretos)

- Backup Neon: `backup-before-10c2-registration-migration`
- Deploy: `dpl_6Se2tZzjM7WP39u9wcdDDEmEoPTQ`
- Helper finance: `apps/clickaton/scripts/lib/seed-staging-test-finance.ts`
- Classifier: `dnx_staging_identity_host` para `ep-round-fog`
