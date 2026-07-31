# Clickatón — Guest Checkout Implementation Report (10C / 10C.2)

**Fecha:** 2026-07-30  
**Veredicto técnico local:** funnel guest→pago→CONFIRMED implementado  
**Veredicto Staging 10C.2:** `CLICKATON E2E PAYMENT TEST BLOCKED` — ver `CLICKATON_10C2_STAGING_E2E_REPORT.md`

### Evidencia Staging 10C.2 (guest)

- Migración `userId` nullable aplicada en `ep-round-fog`.
- Reserva AR2026 real: `PENDING_PAYMENT` · `userId=null` · Remera fase 1 (`stockLimit=100`) · `$25.000`.
- Smoke execute MP: preferencia Checkout Pro creada; **APPROVED** no alcanzado (API 401 / UI secure-fields).

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
