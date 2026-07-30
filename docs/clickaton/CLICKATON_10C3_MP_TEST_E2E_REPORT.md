# Clickatón 10C.3 / 10C.3.1 — MP TEST E2E + fix reconciliación

**Fecha:** 2026-07-30  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Commits:** `be0b089` (reconciliación) · `e482f6e` (media inline Staging)  
**Proyecto Vercel:** `clickaton-staging` (target Production = alias Staging; **no** `clickaton-dnxsuite`)  
**Deploy actual:** `dpl_dW656QCKo2R3mHU5zESwryM3pxoh`  
**Alias:** `https://clickaton-staging.vercel.app`  
**DB host (sanitizado):** `ep-round-fog…-pooler` · health `ok:true`  
**Acción legal:** `LEGAL REVIEW REQUIRED` (no bloquea cierre técnico Staging; sí GO Production)

---

## Causa raíz (10C.3 manual híbrido)

1. Preferencia/checkout generada en **localhost**; return abierto en **Staging**.
2. Token firmado con `AUTH_SECRET` local ≠ Staging → UI «No pudimos verificar el pago».
3. `refreshCheckout` solo leía la **preferencia** (PENDING) y **no** buscaba payment por `external_reference`.
4. Un refresh stale podía aplicar PENDING **después** de APPROVED y degradar la orden DNX.

Corrida híbrida recuperada (force confirm local): Registration **CONFIRMED**, orden **PAID**, credencial ACTIVE, QR emitido. `emailSent=false` por falta de Resend en ese entorno.

---

## Fix 10C.3.1 (código)

| Cambio | Archivo |
|--------|---------|
| Refresh resuelve payment por `external_reference` | `provider-bridge.ts` |
| No downgrade terminal→non-terminal (refresh + apply) | `clickaton-checkout-service.ts` |
| Tests 1–8 reconciliación | `clickaton-checkout-reconciliation.test.ts` |
| Polling S2S «Verificando tu pago…» | `PaymentReturnPoller.tsx` |
| Política monotónica | `CLICKATON_PAYMENT_STATUS_MONOTONICITY.md` |
| Foto perfil en Vercel sin R2 (inline DB metadata) | `welcome-card/storage.ts` + `profile-photo.ts` |

Precedencia: `APPROVED/PAID > PENDING/PROCESSING > CREATED`.

---

## Return token / URLs

Checkout iniciado en Staging firma token con `AUTH_SECRET` Staging y back_urls bajo `CLICKATON_PUBLIC_URL` Staging.  
**Prohibido** preferencia localhost → return Staging.

---

## Env Staging

Presentes (Production del proyecto staging): `AUTH_SECRET`, `CLICKATON_PUBLIC_URL`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `DNX_PAYMENTS_WEBHOOK_*`, `CLICKATON_QR_TOKEN_SECRET`, `CLICKATON_DNX_PAYMENTS_PROVIDER`, `MERCADOPAGO_*`, `DATABASE_URL`/`DIRECT_URL`.

**Ausentes:** `RESEND_API_KEY`, `EMAIL_FROM`, `R2_*` (mitigado con inline DB para draft profile).

---

## Build / tests

| Check | Resultado |
|-------|-----------|
| `check-types` Clickatón | PASS |
| `build` Clickatón | PASS |
| reconciliation tests (9) | PASS |
| adapter + durable tests | PASS |
| guest / auth selfchecks | PASS |

---

## E2E 100% Staging (en curso)

Script: `apps/clickaton/scripts/lib/e2e-10c31-staging-checkout.ts`

### Completado en Staging (sin localhost)

```text
STAGING → AR2026 → INSCRIBIRME → guest → resumen → checkout MP
```

| Campo | Valor sanitizado |
|-------|------------------|
| Registration | `cms77ntt…vn4sj` |
| Email TEST | `e2e10c31.1f6b77@testuser.com` |
| Estado al corte | `PENDING_PAYMENT` |
| Preferencia | `3141372692-702aaadd-…` |
| Checkout host | `www.mercadopago.com.ar` |
| Profile photo upload | OK tras fix inline |

### Pendiente (acción manual)

Pago MP TEST en el navegador (headless choca con anti-crawler de MP):

1. Abrir:  
   `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=3141372692-702aaadd-7f20-426e-b4bf-85cad22d9edf`
2. Tarjeta oficial Mastercard TEST: `5031 7557 3453 0604` · CVV `123` · venc. `11/30` · titular **`APRO`** · DNI `12345678`
3. Tras APPROVED, return debe ir a Staging → «Verificando tu pago…» → **¡Tu inscripción está confirmada!**
4. Validar: orden PAID, Registration CONFIRMED, QR, activación, sin duplicados al refrescar.

### Bloqueo email

Sin `RESEND_API_KEY` / `EMAIL_FROM` en el proyecto → `POST-PAY ACTIVATION EMAIL BLOCKED` hasta configurar Resend TEST o outbox admin con link de activación (sin loguear token).

---

## Veredicto

**No READY aún** — falta cerrar pago APPROVED + cadena post-pay en esta inscripción 100% Staging.

Estado operativo actual:

`MP TEST E2E AWAITING MANUAL PAYMENT` (código de reconciliación **desplegado**; flujo Staging→MP **verificado** hasta checkout)

Tras pago manual exitoso + confirmación UI/DB, candidato a:

`CLICKATON REGISTRATION + CHECKOUT READY IN STAGING`

con salvedad documentada de email si Resend sigue ausente (`POST-PAY ACTIVATION EMAIL BLOCKED` no impide READY técnico de checkout si activación via `/activar` + outbox inspeccionable).
