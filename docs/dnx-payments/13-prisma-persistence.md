# 13 — Persistencia Prisma DNX Payments (Etapa 04)

## Alcance

Persistencia mínima aditiva para el dominio DNX Payments:

- `DnxPaymentRecipient`
- `DnxProviderRecipientAccount`
- `DnxSplitConsent`
- `DnxPaymentIntent`
- `DnxPaymentOrder`
- `DnxProviderOrder`
- `DnxProviderSplit`
- `DnxPaymentIdempotencyRecord`
- `DnxPaymentWebhookInbox`
- `DnxPaymentAuditEvent`

Migración: `packages/db/prisma/migrations/20260715170000_dnx_payments_core_persistence`

## Fuera de alcance

- Cutover ComprameLaFoto / Preferences
- Refunds / payouts / settlements / chargebacks productivos
- Endpoint webhook Production
- Política definitiva de fee MP / owner

## Paquetes

| Capa | Ubicación |
|---|---|
| Schema + SQL | `@repo/db` |
| Ports + in-memory | `@repo/payments` → `application/persistence` |
| Adapter Prisma | `@repo/payments/infrastructure/prisma` |

El core de payments **no** importa Prisma en el entrypoint principal.

## Transacciones

1. Crear intent (+ audit)
2. Reservar idempotencia (+ order interna + audit)
3. Llamar provider **fuera** de TX
4. Registrar provider order + splits + idempotency SUCCEEDED + audit

## Aplicación

Aplicar primero en staging:

```bash
pnpm --filter @repo/db exec prisma migrate deploy
```

No usar `db push` ni `migrate reset`. No aplicar en Production en esta etapa sin autorización explícita.
