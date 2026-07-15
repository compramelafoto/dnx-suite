# 12 — MCP Mercado Pago sandbox tools

Registered in `services/dnx-mcp` via `registerMercadoPagoTools`.

| Tool | Mode |
|---|---|
| `mp_split_environment_status` | read |
| `mp_split_preflight_status` | read / preflight |
| `mp_split_validate_distribution` | local |
| `mp_split_validate_order_payload` | local |
| `mp_split_list_consents` | sandbox GET + confirm |
| `mp_split_get_consent` | sandbox GET + confirm |
| `mp_split_create_test_consent` | sandbox POST + confirm |
| `mp_split_cancel_test_consent` | sandbox PATCH + confirm |
| `mp_split_get_test_order` | sandbox GET + confirm |
| `mp_split_create_test_order` | sandbox POST + confirm |
| `mp_split_persistence_reconcile_dry_run` | local dry-run |

## Guards

- Production writes denied
- Token must be `TEST-` (never returned in tool output)
- Mutable tools require `confirm: true` (or `dryRun: true`)
- Responses redact receiver/order IDs to prefixes
- No refund MCP tools

## Env (`services/dnx-mcp/.env.local`)

Preferir nombres TEST (sandbox Split):

| Variable | Uso |
|---|---|
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | Access Token `TEST-…` (obligatorio para writes) |
| `MERCADOPAGO_TEST_PUBLIC_KEY` | Public Key TEST (tokenización browser) |
| `MERCADOPAGO_TEST_OWNER_USER_ID` | Seller de prueba numérico |
| `MERCADOPAGO_TEST_PARTNER_EMAIL` | `TESTUSER…@testuser.com` |
| `MERCADOPAGO_TEST_DEVICE_ID` | Device ID de prueba |
| `MERCADOPAGO_TEST_PAYMENT_TOKEN` | Token de tarjeta vía MercadoPago.js (efímero) |
| `MERCADOPAGO_ACCESS_TOKEN` | Fallback legacy; mismo requisito `TEST-` |

Nunca `APP_USR-`. Nunca commitear `.env.local`.

### Activación en Cursor

1. Completar vars en `services/dnx-mcp/.env.local`.
2. Reiniciar el servidor MCP **DNX MCP** (Cursor → MCP → Restart).
3. Verificar con `mp_split_environment_status` / `mp_split_preflight_status`.
4. Solo entonces usar tools con `confirm: true`.
