# Mercado Pago Split 1:N — Card Payment Brick (IMPLEMENTACIÓN 03)

**Fecha:** 2026-07-31  
**SDK:** `@mercadopago/sdk-react@1.0.7` (oficial)  
**Primer consumidor:** Clickatón (detrás de flags Orders 1:N TEST)

---

## 1. Arquitectura

```
USUARIO
→ CardPaymentBrickCheckout (client)
→ MercadoPago.js tokeniza (Brick)
→ window.MP_DEVICE_SESSION_ID (oficial)
→ submitRegistrationCardPaymentAction (server)
→ createRegistrationCheckout (server amount)
→ DNX Payments Orders adapter
→ POST /v1/orders + x-meli-session-id
→ UX APPROVED | PROCESSING | REJECTED
```

Shared (no React): `@repo/payments/frontend`  
UI Brick: `apps/clickaton/components/payments/CardPaymentBrickCheckout.tsx`

---

## 2. Setup

1. Instalar dependencia en la app: `@mercadopago/sdk-react`.  
2. Configurar public key (nunca access token en browser).  
3. Flags Orders 1:N TEST ON (ver §3).  
4. CSP con origins MP (ver `apps/clickaton/next.config.ts`).

---

## 3. Env vars (presencia)

| Variable | Rol | Browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Brick init | sí |
| `MERCADOPAGO_TEST_PUBLIC_KEY` | fallback server→prop | no (pasada como prop) |
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | Orders S2S | **no** |
| `CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_orders_test` | bridge | no |
| `DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED` | flag | no |
| `DNX_MP_ORDERS_1N_STAGING_ENABLED` | flag | no |
| `DNX_CONFIRM_STAGING` / `DNX_CONFIRM_ORDERS_TEST` | gates create | no |
| Partner receiver IDs / owner | splits | no |

Production writes: **bloqueados** (gates sandbox).

---

## 4. Flujo

1. Resumen de inscripción con `cardBrickEnabled`.  
2. `initMercadoPago(publicKey)`.  
3. Brick `onSubmit(formData)` → `mapBrickFormDataToCardPaymentSubmission` + `MP_DEVICE_SESSION_ID`.  
4. Server action ignora `transaction_amount` / `clientDisplayedAmountMinor` para el cobro.  
5. Email de cobro = email de inscripción server-side.  
6. Idempotencia = key de reserva existente.

---

## 5. Seguridad

- Access Token solo servidor.  
- Public Key solo frontend.  
- Token de tarjeta: un solo uso, no se loguea (`sanitizeCardPaymentSubmissionForLog`).  
- Sin PAN/CVV en nuestros endpoints.  
- `external_reference` opaco (Imp 02).

---

## 6. Device / session

**Fuente oficial:** `window.MP_DEVICE_SESSION_ID` tras init de MercadoPago.js / SDK React.  
También se mantiene `#deviceId` como sink HTML documentado por MP.  
Backend: `deviceSessionId` → header `x-meli-session-id`.  
Placeholders productivos siguen bloqueados salvo `allowTestFixtures` (sandbox adapter).

---

## 7. Estados UX

`INITIAL → READY → SUBMITTING → PROCESSING → APPROVED | REJECTED | ERROR`  
Mapper: `mapMercadoPagoStatusDetailToUserMessage`.

---

## 8. Sandbox testing

### UNIT / UI MOCK
- `packages/payments` `frontend.test.ts`
- `apps/clickaton/lib/checkout/card-brick-enabled.test.ts`

### SANDBOX REAL (browser)
Requiere interacción humana con tarjeta de prueba MP:

```bash
# Flags + public key + access token TEST configurados
# Abrir resumen de inscripción con checkoutEligible
# Completar Brick con tarjeta de prueba MLA
# Verificar Order en MP + webhook/poller
```

No automatizado en CI sin browser+tarjeta.

---

## 9. Production checklist

- [ ] Public key LIVE vía `NEXT_PUBLIC_*` (solo cuando LIVE esté autorizado)  
- [ ] Access token LIVE solo servidor  
- [ ] Flags LIVE OFF hasta homologación  
- [ ] CSP prod revisada  
- [ ] Refunds (Imp 04)  
- [ ] Homologación MP formal  

---

## CURRENT vs TARGET

**CURRENT (pre-Imp 03):** Checkout Pro redirect / Orders CLI token env.  
**TARGET (Imp 03):** Brick web → token + device real → Orders 1:N server-side.
