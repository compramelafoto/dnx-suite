# Clickatón — Registration + Checkout — Estado actual (10C.2)

**Fecha:** 2026-07-30  
**Branch:** `migration-legacy-clf-to-monorepo`  
**Prerrequisito UX:** `DNX AUTH UX UNIFIED IN STAGING — FULL SUITE`  
**Production:** no tocada · **MP LIVE / apertura real:** no  
**Informe 10C.2:** [`CLICKATON_10C2_STAGING_E2E_REPORT.md`](./CLICKATON_10C2_STAGING_E2E_REPORT.md)

---

## Veredicto

```text
CLICKATON E2E PAYMENT TEST BLOCKED
```

Migración + seed AR2026 + ruta Staging **OK**. Falta pago TEST → `APPROVED`/`CONFIRMED` para declarar `READY IN STAGING`.

| Ítem | Valor |
| ---- | ----- |
| DB Staging | `ep-round-fog…` / `neondb` (`ok:true`) |
| Backup Neon | `backup-before-10c2-registration-migration` |
| Migración guest `userId` nullable | aplicada |
| AR2026 | publicada Staging · Remera `stockLimit=100` |
| Alias | `https://clickaton-staging.vercel.app` |
| Deploy health | `dpl_6Se2tZzjM7WP39u9wcdDDEmEoPTQ` |
| `/maratones/clickaton-argentina-2026` | **HTTP 200** |
| Guest reserva AR2026 | `PENDING_PAYMENT` · `userId=null` · merch OK |
| Preferencia MP TEST | creada (`3141372692-…`) |
| Pago APPROVED | **BLOCKED** (API 401 live-credentials / UI secure-fields) |

`LEGAL REVIEW REQUIRED` sigue pendiente (no bloquea Staging técnico; sí GO Production).

---

## First-N ≠ capacity

| Concepto | Campo | Efecto al agotarse |
| -------- | ----- | ------------------ |
| Capacidad (asientos) | `PricePhase.capacity` / ticket capacity | Puede bloquear inscripción |
| Beneficio first-N | `PricePhaseItem.stockLimit` | Omite merch; inscripción sigue |

AR2026 Staging: Remera fase 1 `stockLimit=100`; `phase.capacity=null`.

---

## Activación DNX post-pago

| Pieza | Estado |
| ----- | ------ |
| Código `/activar` + flags `pago/exito` | READY |
| E2E post-CONFIRMED en Staging | BLOCKED (sin pago APPROVED) |

---

## Clasificación

| Área | Estado |
| ---- | ------ |
| Migración Staging | DONE |
| Seed/config AR2026 Staging | DONE |
| Ruta pública maratón | DONE (200) |
| Guest reserva sin User | DONE (evidencia) |
| Checkout → preferencia MP TEST | DONE |
| Webhook → CONFIRMED | BLOCKED |
| Activación / QR / email / FotoRank E2E | BLOCKED (depende CONFIRMED) |
| Apertura Production / MP LIVE | BLOCKED |

---

## Selfchecks (10C.2)

```bash
pnpm --filter clickaton selfcheck:first-n-benefit
pnpm --filter clickaton selfcheck:guest-registration-identity
pnpm --filter clickaton selfcheck:public-registration-reservation
pnpm --filter clickaton selfcheck:dnx-payments-checkout   # provider manual
pnpm --filter clickaton selfcheck:dnx-payments-smoke     # provider manual
pnpm --filter clickaton test:smoke-db-classify
pnpm --filter clickaton check-types
```
