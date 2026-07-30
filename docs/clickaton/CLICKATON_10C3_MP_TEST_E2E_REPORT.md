# Clickatón 10C.3 / 10C.3.1 — MP TEST E2E + fix reconciliación

**Fecha:** 2026-07-30  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Proyecto Vercel:** `clickaton-staging` (target Production = alias Staging; **no** `clickaton-dnxsuite`)  
**Alias:** `https://clickaton-staging.vercel.app`  
**Acción legal:** `LEGAL REVIEW REQUIRED` (no bloquea cierre técnico Staging; sí GO Production)

---

## Causa raíz (10C.3 manual híbrido)

1. Preferencia/checkout generada en **localhost**; return abierto en **Staging**.
2. Token firmado con `AUTH_SECRET` local ≠ Staging → UI «No pudimos verificar el pago».
3. `refreshCheckout` solo leía la **preferencia** (PENDING) y **no** buscaba payment por `external_reference`.
4. Un refresh stale podía aplicar PENDING **después** de APPROVED y degradar la orden DNX.

Pago MP de esa corrida: `approved` / `accredited` (TEST seller). Tras fix local + force confirm: Registration **CONFIRMED**, orden **PAID (SANDBOX)**, credencial ACTIVE, QR emitido. Activación: user creado; `emailSent=false` desde local (sin Resend en ese entorno).

---

## Fix 10C.3.1 (código)

| Cambio | Archivo |
|--------|---------|
| Refresh resuelve payment por `external_reference` | `packages/payments/.../provider-bridge.ts` |
| No downgrade terminal→non-terminal (refresh + apply) | `clickaton-checkout-service.ts` |
| Tests 1–8 reconciliación | `clickaton-checkout-reconciliation.test.ts` |
| Polling S2S en return «Verificando tu pago…» | `PaymentReturnPoller.tsx` + `PaymentReturnView.tsx` |
| Política monotónica | `docs/clickaton/CLICKATON_PAYMENT_STATUS_MONOTONICITY.md` |

Precedencia: `APPROVED/PAID > PENDING/PROCESSING > CREATED`. Refund/cancel según mapeo DNX existente.

---

## Return token / URLs (Staging)

Checkout en Staging debe usar:

- `CLICKATON_PUBLIC_URL` / `APP_URL` / `NEXT_PUBLIC_APP_URL` → host Staging
- `AUTH_SECRET` Staging (firma token return)
- success / pending / failure bajo ese host

**Prohibido** preferencia localhost → return Staging.

En proyecto `clickaton-staging`, esas vars viven en target **Production** (alias staging). Preview branch solo tiene un subconjunto (DB + keys financieras + MP token). Deploy canónico: **`--prod`** sobre `clickaton-staging`.

---

## Env Staging (auditoría nombres)

Presentes (Production del proyecto staging): `AUTH_SECRET`, `CLICKATON_PUBLIC_URL`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `DNX_PAYMENTS_WEBHOOK_*`, `CLICKATON_QR_TOKEN_SECRET`, `CLICKATON_DNX_PAYMENTS_PROVIDER`, `MERCADOPAGO_*`, `DATABASE_URL`/`DIRECT_URL` (también Preview branch).

**Ausentes en el proyecto:** `RESEND_API_KEY`, `EMAIL_FROM` → gap email activación real.

DB esperada: Neon `ep-round-fog…` / `neondb` (sanitizado).

---

## Build / tests (pre-deploy)

| Check | Resultado |
|-------|-----------|
| `apps/clickaton` `check-types` | PASS |
| `apps/clickaton` `build` | PASS |
| payments reconciliation tests (9) | PASS |
| checkout-pro adapter tests | PASS |
| durable checkout tests | PASS |
| `selfcheck:mercado-pago-test-adapter` | PASS |
| `selfcheck:guest-registration-identity` | PASS |
| `selfcheck:auth` | PASS |
| `selfcheck:dnx-payments-*` contra DB local | FAIL env (distribución/consents locales; no regresión del fix) |

---

## Deploy (completar en ops)

| Campo | Valor |
|-------|--------|
| Commit | _(se completa tras push)_ |
| Deploy ID | _(se completa tras deploy)_ |
| Alias | `https://clickaton-staging.vercel.app` |
| Health | `/api/public/health/db` |
| ¿Production Clickatón? | **No** |

---

## E2E 100% Staging (post-deploy)

Flujo obligatorio (sin localhost):

```text
STAGING → AR2026 → INSCRIBIRME → guest → resumen → checkout
→ MP TEST → APPROVED → retorno STAGING → refresh/webhook → CONFIRMED
```

### Checklist post-pago

- [ ] Return no muestra falso negativo definitivo si token Staging válido
- [ ] Polling «Verificando tu pago…» → confirmación
- [ ] DNX order PAID; Registration CONFIRMED
- [ ] Webhook y/o refresh; ambos órdenes temporales OK; sin duplicar side effects
- [ ] User DNX + activación (`/activar` o canónico)
- [ ] Email/outbox (o bloqueo documentado si falta Resend)
- [ ] Credencial ACTIVE + QR único
- [ ] First-N merch según stock
- [ ] FotoRank sync / estado documentado
- [ ] Panel participante + admin
- [ ] Reintentos refresh sin degradar ni duplicar

---

## Email activación

`emailSent=false` en 10C.3 se debió a ejecución local sin provider.  
En Staging: **no hay `RESEND_API_KEY` / `EMAIL_FROM`** en el proyecto → riesgo `POST-PAY ACTIVATION EMAIL BLOCKED` hasta configurar Resend TEST + sender, o mecanismo outbox/admin para inspeccionar link sin loguear token.

---

## Veredicto

**Pendiente E2E 100% Staging post-deploy.**

Candidatos:

- Éxito: `CLICKATON REGISTRATION + CHECKOUT READY IN STAGING`
- Alternativos: `CLICKATON STAGING RETURN TOKEN BLOCKED` | `MP TEST RECONCILIATION BLOCKED` | `WEBHOOK RECONCILIATION BLOCKED` | `POST-PAY ACTIVATION EMAIL BLOCKED` | `POST-PAY DNX ACTIVATION BLOCKED` | `SIDE EFFECT IDEMPOTENCY BLOCKED`
