# Audit — Partner MP Self-Connect (10D.2.1)

**Fecha:** 2026-07-30  
**Contexto:** `CONTROL USER NOT EQUIVALENT` + `TAMMY OAUTH BLOCKED`

---

## Por qué el flujo actual exige `DNX_FINANCE_OWNER`

| Pieza | Comportamiento |
|-------|----------------|
| `ClickatonOwnerOAuthService.assertFinanceOwner` | Soft-fail si no hay grant `DNX_FINANCE_OWNER` ACTIVE |
| Identity | Crea/usa ORGANIZATION `clickaton:partners-production:mp-owner` |
| Account | `COLLECTOR` + `externalReference=dedicatedProduct=clickaton` |
| Panel | `/admin/finanzas/cuenta-owner` |
| Routes | `/api/clickaton/payments/mercadopago/{connect,callback,reconnect,revoke}` |
| Gates env | Onboarding flag + frase manual exacta |

`PRODUCT_FINANCE_VIEWER` (Tammy) solo habilita `view_agreement` — no Connect.

La matrix `connect_own_account` en `governance.ts` **no está wired** a HTTP.

---

## Modelo de ownership actual

- **Canónico:** `User` → `DnxFinancialIdentity` (`PERSON` / `ORGANIZATION`) → `DnxPaymentAccount`
- **No** hay `userId` directo en `DnxPaymentAccount` (correcto: ownership vía FI `ownerUserId`)
- `DnxPaymentRecipient` es legado/splits; no es el path OAuth moderno
- State OAuth: `DnxMercadoPagoOAuthState.purpose` es `String` libre (ya admite PARTNER_*)
- Vault: origin `clickaton_partner_oauth` **ya tipado** en credential vault

---

## Reutilizable sin duplicar OAuth

| Componente | Reuso |
|------------|-------|
| `buildClickatonMpAuthorizeUrl` / MP HTTP client | Sí |
| PKCE + state hash | Sí |
| `DnxMercadoPagoOAuthState` | Sí (purpose distinto) |
| `CredentialVault.encryptMercadoPagoCredential` | Sí (`origin: clickaton_partner_oauth`) |
| Callback URL MP (única) | Sí — **branch por purpose** |
| Owner service / org collector | **No tocar** |

Separar: authorization (grant), ownership (PERSON FI), purpose (`PARTNER_*`), capability (`SPLIT_RECEIVER`).

---

## Gaps que cierra 10D.2.1

1. Capability `DNX_FINANCE_PARTNER_CONNECT`
2. `ClickatonPartnerOAuthService` + store PERSON
3. Routes partner + callback unificado
4. Panel «Mi cuenta de cobro»
5. Invariante owner no muta
6. Tests + feature flag Staging
