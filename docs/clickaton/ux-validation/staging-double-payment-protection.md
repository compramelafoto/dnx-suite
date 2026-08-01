# Prevención de doble pago — Imp. 04 / revalidación Imp. 05

## UI

| Control | Evidencia |
|---------|-----------|
| Submit lock Brick | `submittingRef` en `CardPaymentBrickCheckout` |
| Botón checkout pending | `disabled={!eligible \|\| pending}` + `aria-busy` en `CheckoutPayButton` |
| Copy pending / éxito no verificado | `presentPaymentReturn` — “No realices un segundo pago…” |
| Banner TEST | `CHECKOUT_PUBLIC_COPY.testBanner` / `CARD_BRICK_PUBLIC_COPY.processing` |
| Auto-start redirect | `autoStartedRef` evita re-submit en remount |

## Tests reejecutados (Imp. 05)

* `pnpm --filter clickaton test:card-brick` → PASS (9)  
* `pnpm --filter clickaton test:public-ux` → PASS (15)  
* Brick real en navegador: **no abierto** (`BRICK_STAGING_BLOCKED`)

## API / backend

Sin cambios en Imp. 05. Idempotencia existente no revalidada end-to-end MP.
