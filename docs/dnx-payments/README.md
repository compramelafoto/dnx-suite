# DNX Payments

Módulo transversal de cobros, distribución, ledger y liquidación para productos DNX.

| Doc | Contenido |
|---|---|
| [04-domain-model.md](./04-domain-model.md) | Lenguaje ubicuo, entidades, límites, flujos, estados |
| [05-ledger-design.md](./05-ledger-design.md) | Ledger append-only |
| [06-distribution-engine.md](./06-distribution-engine.md) | Motor de distribución |
| [07-provider-abstraction.md](./07-provider-abstraction.md) | Capa de providers |
| [08-domain-events.md](./08-domain-events.md) | Domain events |

Código de contratos y reglas puras: `packages/payments` (`@repo/payments`).

**Etapa actual:** diseño de dominio (Etapa 02).  
**No implementado aún:** Orders API Mercado Pago, Prisma, cutover de ComprameLaFoto.
