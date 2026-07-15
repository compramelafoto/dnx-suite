# 16 — Etapa 05A: cuentas TEST y preflight sandbox

## Resultado de auditoría (sin secretos)

| Variable | Presente | Formato válido | Motivo |
|---|---:|---:|---|
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | sí | **no** | `APP_USR_REJECTED` |
| `MERCADOPAGO_TEST_PUBLIC_KEY` | sí | **no** | `APP_USR_not_accepted_for_sandbox_policy` |
| `MERCADOPAGO_TEST_OWNER_USER_ID` | sí | sí | `numeric_ok` (Seller Primary) |
| `MERCADOPAGO_TEST_PARTNER_EMAIL` | **no** | no | `missing` → `BLOCKED_BY_TEST_PARTNER_EMAIL` |
| `MERCADOPAGO_TEST_DEVICE_ID` | no | no | opcional hasta crear orden |
| `MERCADOPAGO_TEST_PAYMENT_TOKEN` | no | no | bloquea orden → `BLOCKED_BY_TEST_PAYMENT_TOKEN` |

**Preflight actual:** `PRODUCTION_TOKEN_REJECTED` (token `APP_USR-`).

No se ejecuta Split Consent ni órdenes hasta corregir token + partner email.

## Seller Primary vs Secondary

| Rol | Variable | Valor correcto |
|---|---|---|
| Seller Primary (owner) | `MERCADOPAGO_TEST_OWNER_USER_ID` | Solo **user ID numérico** |
| Seller Secondary (partner) | `MERCADOPAGO_TEST_PARTNER_EMAIL` | Email `TESTUSER…@testuser.com` |

El Split Consent invita por **email**. El user ID del partner **no** reemplaza al email.

## Corregir Access Token / Public Key

1. Mercado Pago Developers → tu aplicación.
2. Abrí **Credenciales de prueba** (no Producción).
3. Copiá Access Token que empiece con `TEST-`.
4. Copiá Public Key que empiece con `TEST-`.
5. Pegá en `services/dnx-mcp/.env.local`.
6. **Borrá** cualquier valor `APP_USR-` de esas variables TEST.

Esta política del monorepo rechaza `APP_USR-` en sandbox.

## Crear Seller Secondary (partner) — guía exacta

1. Ingresar a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers).
2. Abrir la aplicación habilitada para Orders API.
3. Ir a **Cuentas de prueba** / **Test users**.
4. Crear un usuario de prueba tipo **vendedor**.
5. País: Argentina (MLA) si corresponde.
6. Al crear, MP muestra una sola vez:
   - nickname
   - **email** (`TESTUSER…@testuser.com`)
   - password
   - user ID
7. Guardar fuera de Git (password manager / notas privadas).
8. En `.env.local`:
   - `MERCADOPAGO_TEST_PARTNER_EMAIL=<email TESTUSER…@testuser.com>`
9. No pegar password ni token en el chat.
10. No usar cuenta real para aceptar la invitación.
11. Si el panel solo muestra user ID y no tenés el email → **crear un usuario nuevo** y copiar el email al crearlo.

## Variables canónicas (fuente única)

```text
MERCADOPAGO_TEST_ACCESS_TOKEN
MERCADOPAGO_TEST_PUBLIC_KEY
MERCADOPAGO_TEST_OWNER_USER_ID
MERCADOPAGO_TEST_PARTNER_EMAIL
MERCADOPAGO_TEST_DEVICE_ID
MERCADOPAGO_TEST_PAYMENT_TOKEN
```

Archivo: `services/dnx-mcp/.env.local`  
CLI y MCP leen los mismos nombres.

## Comandos

```bash
pnpm --filter @repo/payments smoke:mp-split-sandbox -- --dry-run
```

Estados útiles:

| Status | Significado |
|---|---|
| `PRODUCTION_TOKEN_REJECTED` | Token `APP_USR-` |
| `BLOCKED_BY_TEST_PARTNER_EMAIL` | Falta / inválido email partner |
| `BLOCKED_BY_TEST_PAYMENT_TOKEN` | Falta token tarjeta / device (solo bloquea orden) |
| `READY` | Consent puede avanzar (dry-run); orden requiere payment token + device |

## Staging

Migración `20260715170000_dnx_payments_core_persistence`: ya applied en `ep-round-fog*`.  
Production: no tocada.
