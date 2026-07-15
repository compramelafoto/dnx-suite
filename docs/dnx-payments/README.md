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
| [12-mcp-mercado-pago-sandbox-tools.md](./12-mcp-mercado-pago-sandbox-tools.md) | MCP tools |

Código: `packages/payments` (`@repo/payments`).

**Etapa 03:** adapter Mercado Pago Orders/Consent **sandbox-only**.  
**No:** Prisma DNX Payments, cutover CLF, refunds reales, production writes.
