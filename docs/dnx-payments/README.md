# DNX Payments

Módulo transversal de cobros, distribución, ledger y liquidación para productos DNX.

| Doc | Contenido |
|---|---|
| [04-domain-model.md](./04-domain-model.md) | Lenguaje ubicuo, entidades, límites, flujos, estados |
| [05-ledger-design.md](./05-ledger-design.md) | Ledger append-only |
| [06-distribution-engine.md](./06-distribution-engine.md) | Motor de distribución |
| [07-provider-abstraction.md](./07-provider-abstraction.md) | Capa de providers |
| [08-domain-events.md](./08-domain-events.md) | Domain events |
| [09-mercado-pago-orders-sandbox-adapter.md](./09-mercado-pago-orders-sandbox-adapter.md) | Adapter Orders sandbox |
| [10-split-consent-sandbox-flow.md](./10-split-consent-sandbox-flow.md) | Split Consent sandbox |
| [11-orders-sandbox-safety-and-idempotency.md](./11-orders-sandbox-safety-and-idempotency.md) | Safety + idempotency |
| [13-prisma-persistence.md](./13-prisma-persistence.md) | Persistencia Prisma core |
| [14-smoke-sandbox.md](./14-smoke-sandbox.md) | Smoke sandbox + preflight CLI |
| [15-staging-apply-and-sandbox-credentials.md](./15-staging-apply-and-sandbox-credentials.md) | Apply staging + guía TEST |
| [16-test-accounts-and-preflight.md](./16-test-accounts-and-preflight.md) | Etapa 05A: cuentas TEST + preflight |
| [financial-identity-domain.md](./financial-identity-domain.md) | Financial Identity + agreements |
| [../clickaton/MERCADO_PAGO_PARTNERS_PRODUCTION_ONBOARDING_10D3I_I0.md](../clickaton/MERCADO_PAGO_PARTNERS_PRODUCTION_ONBOARDING_10D3I_I0.md) | I0: gobernanza onboarding socios MP reales |
| [../clickaton/MERCADO_PAGO_OWNER_PRODUCTION_CONNECTION_10D3I_I1.md](../clickaton/MERCADO_PAGO_OWNER_PRODUCTION_CONNECTION_10D3I_I1.md) | I1: OAuth owner exclusivo Clickatón |

Código: `packages/payments` (`@repo/payments`).

**Etapa 03:** adapter Mercado Pago Orders/Consent **sandbox-only**.  
**Etapa 04:** persistencia Prisma core + CLI preflight/smoke.  
**Etapa 05:** migración payments aplicada en staging (`ep-round-fog`); smoke persistente; guía credenciales TEST.  
**Etapa 05A:** auditoría cuentas TEST; preflight bloqueado hasta `TEST-` token + partner email.  
**Bloque A smoke real MP:** sigue bloqueado.  
**No:** cutover CLF, refunds reales, production writes, migrate deploy Production.
