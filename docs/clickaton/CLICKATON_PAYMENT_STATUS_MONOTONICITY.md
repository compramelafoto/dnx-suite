# Clickatón — Política monotónica de estados de pago (DNX)

**Etapa:** 10C.3.1  
**Alcance:** órdenes DNX de checkout Clickatón (Checkout Pro TEST / sandbox).  
**No aplica a Production LIVE.**

## Precedencia

Dentro de estados “en curso” y “éxito”:

```text
APPROVED / PAID  >  PENDING / PROCESSING  >  CREATED
```

Un pago **terminal exitoso** (`APPROVED` / orden `PAID`) **no** puede volver a:

- `PENDING`
- `CREATED`
- `PROCESSING`

por información stale (p. ej. refresh que solo lee la preferencia MP sin el payment).

## Implementación

| Pieza | Comportamiento |
|-------|----------------|
| `refreshCheckout` (bridge MP TEST) | Si `providerOrderId` no es payment id numérico, busca pago por `external_reference`. |
| `applyNormalizedEvent` | Si el estado actual es terminal (`isTerminalNormalized`) y el evento entrante no lo es → **ignora** (audit `ignored_non_terminal_after_terminal`, outcome `duplicate`). |
| Webhook firmado | `fetchPaymentById` → mismo `applyNormalizedEvent`. |
| Refund / cancel / chargeback | Siguen siendo terminales distintos; no se inventan reglas nuevas fuera del mapeo DNX existente (`map-status.ts`). |

## Return URL / token

Todo checkout iniciado en Staging debe firmar el token con `AUTH_SECRET` de Staging y usar `CLICKATON_PUBLIC_URL` / `APP_URL` Staging en success/pending/failure.  
**Prohibido** generar preferencia en localhost y abrir el return en Staging.

## Tests

`packages/payments/src/__tests__/clickaton-checkout-reconciliation.test.ts`
