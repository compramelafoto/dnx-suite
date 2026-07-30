# Clickatón — Registration + Checkout — Estado actual (10C / 10C.1)

**Fecha:** 2026-07-30  
**Branch:** `migration-legacy-clf-to-monorepo`  
**Prerrequisito UX:** `DNX AUTH UX UNIFIED IN STAGING — FULL SUITE`  
**Production:** no tocada · **MP LIVE / apertura real:** no

---

## Veredicto

```text
CLICKATON REGISTRATION + CHECKOUT PARTIAL IN STAGING
```

Código first-N + activación post-pago **listos**. Deploy Preview verde:

| Ítem | Valor |
| ---- | ----- |
| Commit | `40e21b6` (sobre `526b1a8`) |
| Deploy | `dpl_DJCqY9xT281b1wNBFM258ECe3jCT` |
| URL | https://clickaton-staging-2fzj9vnuw-compramelafotos-projects.vercel.app |

Falta para `READY IN STAGING`:

1. `prisma migrate deploy` en Staging (`ep-round-fog` / `userId` nullable);
2. seed/update AR2026 (`stockLimit=100` Remera fase 1) en Staging;
3. E2E real guest → MP TEST → CONFIRMED → activación → panel (alias staging puede requerir SSO/bypass).

`LEGAL REVIEW REQUIRED` sigue pendiente (no bloquea Staging técnico; sí GO Production).

---

## First-N ≠ capacity

| Concepto | Campo | Efecto al agotarse |
| -------- | ----- | ------------------ |
| Capacidad (asientos) | `PricePhase.capacity` / ticket capacity | Puede bloquear inscripción (`PHASE_CAPACITY_EXCEEDED`) |
| Beneficio first-N | `PricePhaseItem.stockLimit` | **Omite** merch; inscripción sigue |

AR2026: `firstNBenefitLimit: 100` → `stockLimit` en Remera de fase $25k. `phase.capacity` permanece `null`.

Adjudicación: claims = CONFIRMED **o** PENDING_PAYMENT con hold ACTIVE. Confirmación definitiva en `PAYMENT APPROVED → CONFIRMED`.

---

## Activación DNX post-pago

| Pieza | Estado |
| ----- | ------ |
| `linkRegistrationIdentity` | READY |
| `ensurePostConfirmActivation` + `PasswordResetToken` | READY |
| `/activar/[registrationId]` + auth-ui | READY |
| Flags en `pago/exito` (`getReturnResult`) | READY (10C.1) |
| E2E Staging MP TEST | PENDING |

---

## Clasificación

| Área | Estado |
| ---- | ------ |
| Guest → reserva → resumen → DNX Payments TEST → CONFIRMED | READY (código/tests) |
| First-N runtime | READY (código + selfcheck) |
| First-N Staging config | PENDING ops |
| Activación UX | READY (código) |
| Migración Staging userId nullable | PENDING ops |
| E2E pago TEST real | BLOCKED hasta deploy+MP TEST |
| FotoRank sync AR2026 | OFF en seed (ops) |
| Welcome card | READY paid; LIVE publisher false |
| Apertura / Production / MP LIVE | BLOCKED |

---

## Selfchecks

```bash
pnpm --filter clickaton selfcheck:first-n-benefit
pnpm --filter clickaton selfcheck:guest-registration-identity
pnpm --filter clickaton selfcheck:public-registration-reservation
pnpm --filter clickaton selfcheck:dnx-payments-checkout
pnpm --filter clickaton selfcheck:dnx-payments-smoke
```

---

## Docs relacionados

- `CLICKATON_POST_PAYMENT_ACCOUNT_ACTIVATION.md`
- `CLICKATON_GUEST_CHECKOUT_IMPLEMENTATION_REPORT.md`
- `CLICKATON_COMMERCIAL_GO_LIVE_CHECKLIST.md`
- `CLICKATON_GUEST_REGISTRATION_IDENTITY_FLOW.md`
