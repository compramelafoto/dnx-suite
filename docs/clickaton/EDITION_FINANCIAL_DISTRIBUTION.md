# Distribución financiera por edición (Etapa 5)

## Decisión de producto

Para **Clickatón Argentina 2026 (19/09/2026)**:

- DNX Payments obligatorio (sin checkout MP directo).
- Beneficiaria: Tammy (`tammyytamer@gmail.com` solo en seed).
- **Tammy 100% del importe distribuible** después de comisiones inevitables del proveedor (Mercado Pago).
- `platformFee` DNX/Clickatón = **0** en esta edición.
- Sin collector ID / tokens / emails hardcodeados en runtime.
- Arquitectura 1:N (allocations); hoy N=1.

## Importes

| Campo | Significado |
|---|---|
| `grossAmount` | Precio de fase antes del descuento |
| `discountAmount` | Promoción |
| `chargedAmount` | Pagado por el participante |
| `providerFee` | Comisión MP |
| `platformFee` | Comisión DNX (0 en AR 2026) |
| `distributableAmount` | `chargedAmount - providerFee - platformFee` |
| `allocationAmount` | Parte de cada beneficiario sobre `distributableAmount` |

## Modelo (reutilizado)

No se creó `EditionFinancial*` en Prisma. Se mapea a:

| Concepto app | Prisma DNX |
|---|---|
| Distribution | `DnxEconomicAgreement` (`productKey=clickaton`, `scopeType=EDITION`, `scopeId=editionId`) |
| Version DRAFT/ACTIVE/SUPERSEDED | `DnxDistributionVersion` (`DRAFT` / `PUBLISHED`+agreement `ACTIVE` / `SUPERSEDED`) |
| Allocation | `DnxAgreementParticipant` + `DnxDistributionRule` (PERCENTAGE en bps) |
| Conexión MP | `DnxPaymentAccount` |
| Permiso manage | `DnxFinanceGrant` (`DNX_FINANCE_OWNER` / `PRODUCT_FINANCE_MANAGER`) → `canManageEditionFinancialDistribution` |
| Permiso view | `PRODUCT_FINANCE_VIEWER` (+ admins Clickatón lectura UI) |
| Snapshot orden | soft refs en `ClickatonRegistration.financialDistribution*` + futuro `DnxOrderDistributionSnapshot` |
| Auditoría | `ClickatonEditionFinanceAudit` |

### Extensión futura (monto fijo / mixto)

`DnxDistributionRuleKind` ya incluye `FIXED`. No implementado en UI Etapa 5. Redondeo: `LARGEST_REMAINDER`.

## Versionado

- DRAFT editable.
- ACTIVE (`PUBLISHED`) inmutable.
- Cambios → nueva versión.
- Órdenes conservan snapshot; no se recalculan.

## Gate inscripción

Al habilitar `registrationEnabled`, se evalúa distribución ACTIVE, suma 100%, conexiones válidas, DNX Payments y webhook (LIVE). TEST permite conexiones TEST.

## Refunds / ledger

- Ledger durable Prisma: **no existe**; dominio in-memory en `@repo/payments`.
- Refunds productivos: placeholder en payments.
- Gap documentado antes de LIVE: no hay compensación automática de allocations ante chargeback/partial refund.

## Panel

`/admin/ediciones/[editionId]/finanzas`

## Checklist release readiness (finanzas)

- [x] Modelo + permisos + panel + gate + selfcheck 24/24 (Etapa 5 código)
- [ ] Usuario Tammy único + identidad financiera en DB destino
- [ ] Conexión MP ACTIVE (TEST para QA / PROD para LIVE)
- [ ] Distribución DRAFT Tammy 100% creada (seed; no inventa conexión)
- [ ] Distribución ACTIVADA (PUBLISHED) — **no automática** sin MP validada
- [ ] Gate `registrationEnabled` en verde
- [ ] DNX Payments checkout enabled
- [ ] Webhook configurado (LIVE)
- [ ] Orders 1:N usan snapshot de edición (hoy checkout stub owner; gap Etapa 6)
- [ ] Seed re-ejecutado sin duplicar
- [ ] Sin tokens en logs/UI
- [ ] Refund/chargeback policy aceptada (gap documentado)

## Estado Etapa 5 (2026-07-28)

Implementado en Clickatón sin reescribir WIP de `packages/payments`:

- Soft refs + audit en Prisma (`20260728050000_clickaton_edition_finance_soft_refs`)
- Dominio/service/actions/panel `/admin/ediciones/[id]/finanzas`
- Seed grants Daniel manage; Tammy/Rodrigo viewer; DRAFT Tammy 100%
- Snapshot al crear checkout si hay ACTIVE; gate al habilitar inscripción
- `selfcheck:edition-finance` 24 checks

## Estado Etapa 6 (2026-07-28)

- Snapshot v2 → fuente de verdad del checkout (`editionFinance`)
- `DnxPaymentOrderAllocation` (settlement projection)
- Checkout Pro collector OAuth del beneficiario (N=1); **sin stub owner** cuando hay snapshot
- Motor bps + tests; doc `DNX_PAYMENTS_CHECKOUT_1N.md`
- Panel readiness checkout
- WIP ajeno de refresh MP (`skipTestToken` / search payments) **no sobrescrito** más allá de extender `accessTokenOverride`

Ver checklist LIVE en `DNX_PAYMENTS_CHECKOUT_1N.md`.
