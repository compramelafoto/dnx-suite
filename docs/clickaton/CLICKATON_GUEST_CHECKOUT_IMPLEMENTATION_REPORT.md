# Clickatón — Guest Checkout Implementation Report (10C / 10C.1)

**Fecha:** 2026-07-30  
**Veredicto técnico local:** funnel guest→pago→CONFIRMED implementado  
**Veredicto Staging:** ver `CLICKATON_REGISTRATION_CHECKOUT_CURRENT_STATE.md`

---

## Arquitectura

```text
Anónimo → Wizard → PENDING_PAYMENT + holds
       → Resumen HMAC
       → DNX Payments (TEST)
       → Webhook APPROVED
       → CONFIRMED + QR + first-N merch (si cupo)
       → link User DNX + activación
```

## First-N Benefit (10C.1)

- Campo: `ClickatonPricePhaseItem.stockLimit`
- ≠ `phase.capacity` (asientos)
- Dominio: `lib/catalog/domain/first-n-benefit.ts`
- Service filtra con `countPhaseBenefitClaims`; TX re-valida (`reservedItems`)
- Al agotar beneficio: inscripción **sigue** sin merch (nunca `PHASE_CAPACITY_EXCEEDED`)
- Seed AR 2026: `firstNBenefitLimit: 100` en Remera Fase 1

## Identidad

- `userId` nullable en reserva
- `resolveIdentityCandidate` / `linkRegistrationIdentity`
- Activación: `CLICKATON_POST_PAYMENT_ACCOUNT_ACTIVATION.md`

## Pagos

- Solo vía `@repo/payments` / DNX Payments
- Precios server-side
- Webhooks idempotentes
- FREE $0: `confirmFreeRegistration` sin MP

## Tests

- `selfcheck:guest-registration-identity`
- `selfcheck:first-n-benefit`
- `selfcheck:public-registration-*`
- `selfcheck:dnx-payments-*`
