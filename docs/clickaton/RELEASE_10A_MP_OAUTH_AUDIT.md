# RELEASE 10A — Auditoría Mercado Pago OAuth

**Fecha:** 2026-07-28  
**Código:** `packages/payments/src/partner-onboarding/owner-oauth/` + rutas Clickatón  
**Doc previa:** `MERCADO_PAGO_OWNER_PRODUCTION_CONNECTION_10D3I_I1.md`  
**OAuth real LIVE:** **NO EJECUTADO** (sigue pendiente autorización humana)

---

## 1. Tensión de producto (documentar, no resolver en 10A)

| Fuente | Modelo |
|--------|--------|
| **I1 (2026-07-23)** | Opción B: cuenta MP **exclusiva Clickatón** (no personal Tammy/Daniel/Rodri). Owner org FI `clickaton:partners-production:mp-owner`. |
| **Etapa 10A / finance AR 2026** | Tammy como beneficiaria 100% post-PSP vía `DnxPaymentAccount` ligada a su `User.id` / Financial Identity; edición selecciona collector. |

**Implicación:** hay **dos caminos** en código/docs:

1. **Owner OAuth dedicado** (`ClickatonOwnerOAuthService`, panel `/admin/finanzas/cuenta-owner`, flags `DNX_CLICKATON_MP_OWNER_*`).
2. **Beneficiary / partner account de Tammy** (edition finance + allocations + `paymentBeneficiaryConfig`).

10A **no** conecta ni elige. 10B debe decidir cuál se usa para cobros AR 2026 (o secuencia: Tammy collector OAuth personal vs owner exclusivo + split).

---

## 2. Integración OAuth existente (owner path)

| Pieza | Estado |
|-------|--------|
| App MP dedicada | Decisión documentada; credenciales **no** verificadas en Vercel staging/prod listados |
| `CLICKATON_MP_CLIENT_ID` / `SECRET` | Nombres definidos; **ausentes** en env Vercel auditados |
| Redirect URI | Staging: `https://clickaton-staging.vercel.app/api/clickaton/payments/mercadopago/callback` · Prod: `https://maratonfotografica.com/api/clickaton/payments/mercadopago/callback` |
| Rutas | `GET …/connect`, `GET …/callback`, `POST …/revoke`, `POST …/reconnect` |
| State | Hash single-use, TTL ~10m, bound user/FI/product/purpose/env (`DnxMercadoPagoOAuthState`) |
| PKCE | S256; verifier cifrado en state row |
| Scopes intent | `offline_access` + `read` (+ write si Orders lo exige) |
| Vault | AES-GCM + `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY`; `credentialReference` en `DnxPaymentAccount` |
| Refresh / expiry / revoke | Dominio owner-oauth (revoke/reconnect) |
| Webhook pagos | `/api/webhooks/dnx-payments` (HMAC `DNX_PAYMENTS_WEBHOOK_SECRET`) — distinto del OAuth callback |
| TEST vs LIVE | Gates + `DnxFinancialEnvironment`; provider checkout `mercado_pago_test` en staging |
| Ownership | `DnxPaymentAccount.financialIdentityId` → `DnxFinancialIdentity` → user ownership (no solo email/URL/sesión) |
| Panel | `/admin/finanzas/cuenta-owner` → `notFound()` si onboarding flag OFF |
| HTTP connect | Checklist / mensaje; **no** redirige aún a authorize URL de MP |
| HTTP callback | Responde `CALLBACK_SERVICE_PENDING_RUNTIME_BINDING` — **no** hace exchange ni guarda token hasta binding Prisma+vault en ventana controlada |

### Flujo esperado (código)

1. Actor con permiso inicia sesión DNX.  
2. Abre conectar MP (flag ON + frase autorización si LIVE).  
3. Backend genera authorize URL + state/PKCE.  
4. MP → callback.  
5. Valida state.  
6. Exchange code.  
7. Credenciales → vault.  
8. Upsert `DnxPaymentAccount`.  
9. Vínculo a FI / `User.id` del actor (owner path: org FI Clickatón).  
10. Clickatón selecciona cuenta vía agreement/distribution/beneficiary config.  
11. Reuso cross-app solo con grants explícitos.

**Confirmado en modelo:** la cuenta **no** debe quedar atada solo a edición/email/URL/sesión; el schema ancla en `financialIdentityId`.

---

## 3. MCP / sandbox status (auditoría herramientas)

| Herramienta | Resultado |
|-------------|-----------|
| `mp_split_environment_status` | Credenciales sandbox **presentes**; `isTestPrefix: false` → **WARNING mezcla** (variable `MERCADOPAGO_TEST_ACCESS_TOKEN` sin prefijo TEST clásico) |
| `waitingMpConfirmation` | fee_allocation, seller_primary, taxes, settlements (pendientes lado MP) |
| `release_prepare(platformId=clickaton)` | **FAIL** — Clickatón **no** está en Platform Catalog MCP |
| Split consents MCP | Disponibles solo sandbox; no usados para OAuth owner |

---

## 4. Variables OAuth (presencia)

| Variable | Local `.env.local` Clickatón | Staging Vercel | Prod Vercel |
|----------|------------------------------|----------------|-------------|
| `CLICKATON_MP_CLIENT_ID` | no en scan | ausente | ausente |
| `CLICKATON_MP_CLIENT_SECRET` | — | ausente | ausente |
| `CLICKATON_MP_REDIRECT_URI` | — | ausente | ausente |
| `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` | — | ausente | ausente |
| `DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED` | — | ausente | ausente |
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | — | presente | ausente en listado prod |
| `DNX_PAYMENTS_WEBHOOK_SECRET` | — | presente | ausente en listado prod |

---

## 5. Tammy como beneficiaria (edition finance)

- Fee policy AR 2026: Tammy 100% distribuible post fee PSP (`ARGENTINA_2026_FEE_POLICY`).
- UI finanzas busca user `tammyytamer@gmail.com` y su FI.
- Checkout exige snapshot finance + collector token resuelto (`edition_finance_collector_token_required`).
- **Sin** `DnxPaymentAccount` ACTIVE de Tammy → checkout MP real **bloqueado** (correcto para 10A).

---

## 6. Clasificación

| Ítem | Estado |
|------|--------|
| Código OAuth + PKCE + state + vault | **READY** (dominio; selfchecks payments 218 OK) |
| HTTP wiring connect/callback | **BLOCKED** (`CALLBACK_SERVICE_PENDING_RUNTIME_BINDING`) |
| App MP + secrets en entornos | **BLOCKED** |
| OAuth ejecutado / cuenta guardada | **BLOCKED** |
| Decisión owner exclusivo vs Tammy collector | **BLOCKED** (producto) |
| Webhook HMAC staging | **READY WITH WARNING** (secret presente; firma e2e no re-ejecutada aquí) |
| Webhook prod | **BLOCKED** (secret no listado en prod) |
| Mezcla TEST/LIVE | **READY WITH WARNING** / posible **BLOCK** si attestation falla |
| Activar cobros | **NO** (10A) |

---

## 7. Checklist humano 10B (sin automatizar 2FA/CAPTCHA)

1. Resolver decisión producto (owner exclusivo vs Tammy OAuth personal).  
2. Configurar app MP + redirect exactos.  
3. Cargar secrets solo en entorno correcto (staging≠prod, TEST≠LIVE).  
4. Primer login Tammy DNX.  
5. Conectar OAuth en ventana controlada.  
6. Verificar `DnxPaymentAccount` + enmascarado en panel.  
7. Asociar a edición AR 2026 como collector.  
8. Apagar flags de onboarding.
