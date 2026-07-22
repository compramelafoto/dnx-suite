# ADR 0002 — Financial Identity y Economic Agreements

| Metadato | Valor |
|----------|-------|
| **Estado** | Aceptado |
| **Fecha** | 2026-07-22 |
| **Etapa** | 10D3I-C |
| **Base** | Auditoría 10D3I-A + diseño 10D3I-B |

---

## Contexto

Las cuentas Mercado Pago vivían acopladas a `User.mp*` / `Lab.mp*` (CLF) y los porcentajes no tenían un contrato versionado transversal. Clickatón necesita Split 1:N multi-participante sin atar la cuenta PSP a un rol o producto.

## Decisiones

1. **Las cuentas financieras pertenecen a `FinancialIdentity`**, no a Clickatón, CLF, ni a un rol (fotógrafo/organizador/sponsor).
2. **Los porcentajes pertenecen a `EconomicAgreement` versionado** (`DistributionVersion` + `DistributionRule` en bps). Nunca al User.
3. **Los snapshots de orden son inmutables** (`DnxOrderDistributionSnapshot` + JSON compatible en Intent/Order).
4. **Los productos no almacenan secretos PSP.** Solo `credentialReference` opaca / consent refs; vault real en etapa posterior.
5. **Dual-read legacy (`User.mp*`) es transición temporal** (10D3I-D). En 10D3I-C solo mapper dry-run.
6. **Permisos financieros son grants explícitos** (`DnxFinanceGrant`) — no email hardcodeado ni allowlist admin de producto.

## Consecuencias

- Migración Prisma aditiva; CLF checkout intacto.
- Clickatón Preferences sigue hasta cutover Orders controlado.
- Reutiliza distribution engine y tablas DNX Payments existentes vía bridges.
