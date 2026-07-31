# DNX Payments — Partner Mercado Pago Self-Connect

**Etapa:** 10D.2.1  
**Feature flag:** `DNX_PARTNER_MP_SELF_CONNECT_ENABLED`  
**Environment:** `DNX_PARTNER_MP_OAUTH_ENVIRONMENT` = `TEST` | `PROD` (default inferido)

---

## Conceptos

| Rol | Qué es | Grant |
|-----|--------|-------|
| **Finance Owner** | Collector / cuenta plataforma (ORGANIZATION) | `DNX_FINANCE_OWNER` |
| **Partner / Recipient** | Usuario que conecta **su** MP para recibir | `DNX_FINANCE_PARTNER_CONNECT` |

Separación obligatoria:

```text
VIEW (PRODUCT_FINANCE_VIEWER)
≠ CONNECT OWN (DNX_FINANCE_PARTNER_CONNECT)
≠ MANAGE GLOBAL (DNX_FINANCE_OWNER)

SUPER_ADMIN ≠ FINANCE_OWNER ≠ PARTNER_CONNECT ≠ VIEWER
```

`DNX_FINANCE_PARTNER_CONNECT` es un **permiso financiero personal explícito** (`DnxFinanceGrant`).  
Un Super Admin **puede** recibirlo, pero **nunca** se deriva del rol `SUPER_ADMIN`.  
No modificar la definición global de `SUPER_ADMIN` para incluir connect.

Matriz canónica Clickatón (Daniel / DNX Estudio / Tammy):  
`docs/dnx-payments/DNX_FINANCE_ROLE_MATRIX.md`

OAuth **no** asigna porcentajes. Asignar recipient / bps es un paso aparte.

---

## Flujo

```text
User DNX (sesión)
→ grant PARTNER_CONNECT
→ /admin/finanzas/mi-cuenta
→ GET /api/dnx-payments/partner/mercadopago/connect
→ MP authorize
→ GET /api/clickaton/payments/mercadopago/callback  (purpose PARTNER_*)
→ vault (origin clickaton_partner_oauth)
→ DnxPaymentAccount ACTIVE (PERSON FI, SPLIT_RECEIVER)
```

Callback compartido con owner; el `purpose` del state decide el branch.

---

## Ownership

- Identity: `DnxFinancialIdentity` PERSON (`ownerUserId` = User.id)
- Account: `originApp=dnx_partner`, `externalReference=accountType=PARTNER`
- Capabilities: `SPLIT_RECEIVER` + `PAYOUT_DESTINATION` (nunca `COLLECTOR`)
- Invariante: owner ORGANIZATION collector **no** cambia

---

## Routes

| Método | Path |
|--------|------|
| GET | `/api/dnx-payments/partner/mercadopago/connect` |
| POST | `/api/dnx-payments/partner/mercadopago/reconnect` |
| POST | `/api/dnx-payments/partner/mercadopago/revoke` |
| GET | `/api/clickaton/payments/mercadopago/callback` (shared) |

Panel: `/admin/finanzas/mi-cuenta`

---

## Fixture grants (reversible)

```bash
DATABASE_URL=... pnpm --filter clickaton exec tsx scripts/seed-partner-connect-grants.ts
DATABASE_URL=... pnpm --filter clickaton exec tsx scripts/seed-partner-connect-grants.ts --revoke
```

Targets: Tammy + `compramelafoto@gmail.com`. Sin `DNX_FINANCE_OWNER`. Sin OAuth.

---

## Tests

`packages/payments/src/partner-onboarding/partner-oauth/partner-oauth.test.ts`
