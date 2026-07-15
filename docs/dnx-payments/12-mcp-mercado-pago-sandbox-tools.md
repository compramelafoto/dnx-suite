# 12 — MCP Mercado Pago sandbox tools

Registered in `services/dnx-mcp` via `registerMercadoPagoTools`.

| Tool | Mode |
|---|---|
| `mp_split_environment_status` | read |
| `mp_split_validate_distribution` | local |
| `mp_split_validate_order_payload` | local |
| `mp_split_list_consents` | sandbox GET + confirm |
| `mp_split_get_consent` | sandbox GET + confirm |
| `mp_split_create_test_consent` | sandbox POST + confirm |
| `mp_split_cancel_test_consent` | sandbox PATCH + confirm |
| `mp_split_get_test_order` | sandbox GET + confirm |
| `mp_split_create_test_order` | sandbox POST + confirm |

## Guards

- Production writes denied
- Token must be `TEST-` (never returned in tool output)
- Mutable tools require `confirm: true` (or `dryRun: true`)
- Responses redact receiver/order IDs to prefixes
- No refund MCP tools

## Env

`MERCADOPAGO_ACCESS_TOKEN` (optional) — only names/lengths/prefix reported by status tool.
