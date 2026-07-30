# Clickatón 10C.3 / 10C.3.1 — MP TEST E2E + fix reconciliación

**Fecha:** 2026-07-30  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Commits clave:** `be0b089` (reconciliación) · `e482f6e` (media inline) · `b3a5bfe` (informe/scripts)  
**Proyecto Vercel:** `clickaton-staging` (target Production = alias Staging; **no** `clickaton-dnxsuite`)  
**Deploy:** `dpl_dW656QCKo2R3mHU5zESwryM3pxoh`  
**Alias:** `https://clickaton-staging.vercel.app`  
**DB host (sanitizado):** `ep-round-fog…-pooler`  
**Acción legal:** `LEGAL REVIEW REQUIRED` (no bloquea cierre técnico Staging; sí GO Production)

---

## Veredicto

# `CLICKATON REGISTRATION + CHECKOUT READY IN STAGING`

E2E 100% Staging cerrado: pago MP TEST → return Staging con token válido → refresh S2S → Registration **CONFIRMED** + orden **PAID**.

Salvedad no bloqueante de checkout: sin `RESEND_API_KEY` en Staging el mail puede no enviarse; hay token de set-password en DB (`resetUnused: 1`) y flujo `/activar`.

---

## Causa raíz (10C.3 híbrido fallido)

1. Checkout firmado en localhost / abierto en Staging → `AUTH_SECRET` distinto.  
2. `refreshCheckout` no buscaba payment por `external_reference`.  
3. PENDING stale podía degradar APPROVED.

---

## Fix desplegado

| Cambio | Detalle |
|--------|---------|
| Refresh por `external_reference` | `provider-bridge.ts` |
| Monotonicidad terminal | `clickaton-checkout-service.ts` |
| Tests 1–8 | `clickaton-checkout-reconciliation.test.ts` |
| UI polling return | `PaymentReturnPoller` → «Verificando…» → confirmado |
| Foto perfil sin R2 en Vercel | inline `metadata.inlineBase64` |

---

## E2E 100% Staging (cerrado)

```text
STAGING → AR2026 → guest → resumen → MP TEST → APPROVED
→ return Staging (token Staging) → refresh S2S → CONFIRMED
```

| Campo | Valor |
|-------|--------|
| Registration | `cms77ntt…vn4sj` |
| Número | `CKA26-00002` |
| Participante | E2E Staging |
| Email TEST | `e2e***@testuser.com` |
| Registration status | **CONFIRMED** |
| Payment status | **APPROVED** |
| DNX order | **PAID** / **SANDBOX** |
| Provider | `approved` / `PROCESSED` |
| Credencial | **ACTIVE** · QR activos: **1** |
| Holds | capacity + stock **CONSUMED** |
| Merch | Remera XS · fulfillment `PENDING` (esperado) |
| Welcome card (DB) | **GENERATED** (UI pudo mostrar PENDING un instante) |
| User DNX | id `60` · sin password · activación pendiente |
| Reset/set-password | 1 token unused en DB |
| Audit clave | `refresh.live_mode_attested_sandbox` + `event.applied` **APPROVED** |

Return UI observado: **«¡Tu inscripción está confirmada!»** + copy de confirmación por sistema (no solo navegador).

---

## Env / email

- Staging: URLs + `AUTH_SECRET` + MP TEST + webhook + QR secret OK.  
- **Ausente:** `RESEND_API_KEY` / `EMAIL_FROM` en `clickaton-staging`.  
- Presente en `clickaton-dnxsuite` Production (no copiado automáticamente).

---

## Idempotencia / reconciliación

- Refresh S2S resolvió payment APPROVED con `live_mode` attestado sandbox.  
- No se observó downgrade post-confirm.  
- Side effects: 1 credencial, 1 QR, holds consumidos una vez.

---

## FotoRank / paneles

- Welcome outbox: card `PROCESSED`, publish aún `PENDING` (no bloquea checkout).  
- Paneles participante/admin: validación operativa restante recomendada; no bloquean READY de registration+checkout.

---

## Alternativas descartadas

| Estado | ¿Aplica? |
|--------|----------|
| `CLICKATON STAGING RETURN TOKEN BLOCKED` | No (return confirmó) |
| `MP TEST RECONCILIATION BLOCKED` | No |
| `WEBHOOK RECONCILIATION BLOCKED` | No (refresh S2S suficiente; webhook no requerido para este cierre) |
| `POST-PAY ACTIVATION EMAIL BLOCKED` | Parcial (Resend ausente; activación por token/DB posible) |
| `SIDE EFFECT IDEMPOTENCY BLOCKED` | No |
