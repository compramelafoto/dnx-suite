# IMP 06 — Card Payment Brick browser REAL (Clickatón)

**Tipo:** SANDBOX REAL (browser + tarjeta oficial TEST)  
**No es:** UNIT / mock / CLI `/v1/card_tokens`

Cursor **no** completa el input de tarjeta en iframes MP. Dani ejecuta los pasos 1–9; Cursor verifica con el comando del paso 10.

## Flags (no secretos)

```bash
CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_orders_test
DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED=true
DNX_MP_ORDERS_1N_STAGING_ENABLED=true
DNX_CONFIRM_STAGING=true
DNX_CONFIRM_ORDERS_TEST=true
# Production must stay OFF:
# DNX_MP_ORDERS_1N_PRODUCTION_ENABLED must NOT be true
```

Credenciales TEST solo en `.env.local` / secret store:

- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` (o `MERCADOPAGO_TEST_PUBLIC_KEY`)
- `MERCADOPAGO_TEST_ACCESS_TOKEN`
- owner + partner receiver IDs TEST

## Procedimiento exacto (Dani)

1. En la raíz del monorepo: `pnpm --filter clickaton dev` → `http://localhost:3005`
2. Abrir la inscripción pública TEST de la edición activa (ej. `/maratones/<slug>/inscripcion`).
3. Completar el wizard hasta el paso de **pago / resumen** con `checkoutEligible`.
4. Confirmar visualmente el **Card Payment Brick** (no botón Checkout Pro legacy).
5. DevTools → Console, tras ready del Brick:
   ```js
   Boolean(window.MP_DEVICE_SESSION_ID)
   // esperado: true
   // NO pegar el valor completo en docs/tickets
   ```
6. DevTools → Console: filtrar CSP / errores rojos. No debe haber bloqueos a `sdk.mercadopago.com` / `api.mercadopago.com` / iframes MP.
7. Pagar con **tarjeta oficial de prueba MLA** (documentación Mercado Pago — no guardar PAN/CVV en el repo).
8. Esperar estado UI → redirect `/pago/exito` | `/pago/pendiente` | `/pago/error`.
9. Copiar **solo** IDs técnicos:
   - `registrationId` (URL o UI)
   - `providerOrderId` / Order ID del panel MP o logs server (`ORD…`)  
   **Nunca** tarjeta ni token.
10. Verificar Order (Cursor / terminal):
    ```bash
    MERCADOPAGO_SMOKE_ORDER_ID='ORD…' \
    MERCADOPAGO_SMOKE_REGISTRATION_ID='…' \
    pnpm --filter @repo/payments smoke:imp06-brick-verify
    ```

## Criterio PASS

| Check | Esperado |
| --- | --- |
| Brick carga | sin error CSP |
| `window.MP_DEVICE_SESSION_ID` | presente |
| Server log | `DEVICE_SESSION_PRESENT: true` (sin valor completo) |
| Order | `processed` / `accredited` vía GET |
| Monto | reconstruido server-side (no tampering del Brick) |
| Source | distinta de CLI `card_tokens` |

## Si falla device session

Investigar SDK/Brick oficial. **No** inventar UUID fallback.
