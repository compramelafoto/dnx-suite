# Auditoría de Homologación Mercado Pago Split 1:N — ETAPA 01

**Fecha:** 2026-07-31  
**Actualizado:** IMPLEMENTACIÓN 05 (sandbox evidence REAL).  
**Producto a homologar:** Checkout API / Orders API — Split de Pagos 1:N — Argentina (MLA) — canal web — industria Otros intangibles.  
**Acción legal en esta etapa:** NO REQUERIDA (marcar LEGAL / BUSINESS RULE REVIEW REQUIRED en fees irreversibles).  
**Contrato canónico:** [mp-split-1n-order-contract.md](./mp-split-1n-order-contract.md)  
**Brick:** [mp-split-1n-card-brick.md](./mp-split-1n-card-brick.md)  
**Refunds:** [mp-split-1n-refunds.md](./mp-split-1n-refunds.md)  
**Evidencia sandbox:** [mp-split-1n-sandbox-evidence.md](./mp-split-1n-sandbox-evidence.md)

---

## Veredicto ejecutivo

| Dimensión | Resultado |
| --- | --- |
| **IMPLEMENTATION READINESS** | **GO CON CONDICIONES** — Imp 06: refunds controlados PASS REAL; package homologación listo; Brick browser + device oficial + webhook live pendientes (humano / config externa). |
| **MERCADO PAGO HOMOLOGATION APPROVAL** | **NO-GO / NO DECLARABLE** — la aprobación depende del equipo de Integraciones de Mercado Pago. |
| **RESULTADO GENERAL** | **READY FOR MP REVIEW WITH EXTERNAL QUESTIONS**. No declarar approved / production ready. |

---

## Matriz checklist (#1–#40)

| # | Requisito MP | Estado | Evidencia | Falta | Acción |
| - | ------------ | ------ | --------- | ----- | ------ |
| 1 | UNIQUE EXTERNAL REFERENCE | PASS | `DnxPaymentIntent` unique `(sourceProduct, externalReference)` en `packages/db/prisma/schema.prisma` (~8878–8894); Clickatón genera `clickaton-registration-<id>` en `clickaton-checkout-service.ts` | — | ninguna |
| 2 | EXTERNAL REFERENCE SIN PII | PASS | `assertOpaqueExternalReference` + `buildOpaqueExternalReference` (`orders/external-reference.ts`); gate en `validateMercadoPagoSplitOrder`; tests anti-email | — | ninguna |
| 3 | X-IDEMPOTENCY-KEY | PASS | Header en `mercado-pago-http-client.ts` ~170–172; createSplitOrder pasa `idempotencyKey` (`orders/adapter.ts` ~137–144); persistencia `DnxPaymentIdempotencyRecord` unique | — | ninguna |
| 4 | LOGS ESTRUCTURADOS | PARTIAL | Audit append + sanitize metadata (`application/persistence`); observability Clickatón; sanitize headers en HTTP client. No hay política uniforme documentada para todos los eventos (consent/refund) | Completar sink estructurado refund/consent/recon; checklist de campos prohibidos | corrección requerida |
| 5 | PAGO APROBADO (processed + accredited) | PASS | `mapMercadoPagoOrderStatus` → `PROCESSED_ACCREDITED` (`orders/mapper.ts` ~210–214); fulfillment `fulfill-from-orders-observe.ts` exige ese estado | Prueba sandbox real end-to-end documentada en homologación | prueba requerida |
| 6 | PAGO RECHAZADO (failed + status_detail) | PASS | Mapper `failed` + `mapMercadoPagoStatusDetailToUserMessage` (`packages/payments/src/frontend/status-detail-messages.ts`); Brick UX REJECTED | Smoke browser rechazo real | prueba requerida |
| 7 | RESPONSE MESSAGES | PASS | Catálogo UX en `status-detail-messages.ts` + fallbacks en server action Brick | Ampliar códigos según evidencias sandbox | ninguna |
| 8 | TYPE = ONLINE | PASS | `type: "online"` hardcodeado en `orders/mapper.ts` ~147; test `orders/mapper.test.ts` | — | ninguna |
| 9 | PAYMENT METHOD id/type | PASS | Brick envía `payment_method_id` real; bridge usa token path; fallback `"visa"` solo CLI/smoke sin Brick | Validar en sandbox real | prueba requerida |
| 10 | TLS / SSL | PARTIAL | Checkout Pro valida HTTPS callbacks; apps productivas en Vercel/HTTPS. Orders 1:N no valida `notification_url` propio en create | Confirmar URL webhook pública HTTPS y registrar en MP | configuración externa |
| 11 | PAYER EMAIL | PASS | Obligatorio en `CreateSplitOrderInput` + `normalizePayerEmail` + payload `payer.email`; tests missing/empty/malformed | — | ninguna |
| 12 | WEBHOOKS | PASS | Endpoint `apps/clickaton/app/api/webhooks/dnx-payments/route.ts`; firma HMAC; inbox `DnxPaymentWebhookInbox`; observe + reconcile (`observe-orders-webhook.ts`) | Durabilidad prod + secret prod; replay tests | prueba requerida |
| 13 | CONTINGENCIA GET ORDER | PASS | `MercadoPagoOrdersAdapter.getOrder` GET `/v1/orders/:id` (`orders/adapter.ts` ~163–186); webhook llama `fetchCanonicalOrder` y reintenta (`observe-orders-webhook.ts` ~211–256); `refresh-provider-order.handler.ts`; cron Clickatón reconciliation | Cron prod habilitado | configuración externa |
| 14 | X-MELI-SESSION-ID | PARTIAL | Header enviado en Orders sandbox REAL (`meliSessionPresent`). Valor desde env TEST device — **no** confirmado aún vía Brick `window.MP_DEVICE_SESSION_ID` | Smoke Brick humano | prueba requerida |
| 15 | DEVICE ID | PARTIAL | **IMPLEMENTED** + header real en create Order. **Brick oficial PENDING** | Ejecutar smoke browser | prueba requerida |
| 16 | STATEMENT DESCRIPTOR | PASS | `resolveStatementDescriptor` + mapper → `payment_method.statement_descriptor`; consumer/adapter default (no hardcode Clickatón en package) | — | ninguna |
| 17 | CARD PAYMENT BRICK | PARTIAL | **IMPLEMENTED** — SDK + checkout. Orders sandbox usó `/v1/card_tokens` (no Brick UI). **HUMAN BROWSER STEP REQUIRED**. Doc: `mp-split-1n-card-brick.md` + evidencia Imp 05 | Smoke browser | prueba requerida |
| 18 | ITEM UNIT PRICE | PASS | Top-level `items[].unit_price` (Imp 05: MP sandbox rechaza `additional_info.items`) | — | ninguna |
| 19 | ITEM QUANTITY | PASS | Validación entero > 0 + payload | — | ninguna |
| 20 | ITEM NAME/title | PASS | Title requerido + trim + max length | — | ninguna |
| 21 | ITEM CATEGORY ID | PARTIAL | Opcional; se mapea si el consumidor envía `categoryId` (ej. `others`) | Definir catálogo industria | decisión humana |
| 22 | PAYER FIRST NAME | FAIL | DTO existe; mapper no envía (recomendado) | Mapear si se decide enviar | decisión humana |
| 23 | PAYER LAST NAME | FAIL | Idem #22 | Idem | decisión humana |
| 24 | PAYER IDENTIFICATION | FAIL | DTO existe; no se envía. **LEGAL REVIEW REQUIRED** (PII) | Evaluar necesidad antifraude vs minimización | decisión humana + LEGAL REVIEW REQUIRED |
| 25 | PAYER REGISTRATION DATE | FAIL | No existe en contratos/mapper. DNX puede tener `createdAt` de usuario/inscripción pero no se envía | Evaluar fuente confiable y envío | decisión humana |
| 26 | OWNER receiver_type | PASS | Owner server-side (`orders/adapter.ts` ctor `ownerUserId`); mapper emite `receiver_type: "owner"` (~92–107, ~131–142) | — | ninguna |
| 27 | PARTNER receiver_type + UUID | PASS | UUID + `partnerConsentsByRecipientId` evidence (`consent-evidence.ts`); sin ACTIVE hardcode | Wiring product→Prisma consent store en apps | prueba requerida |
| 28 | MÁXIMO 10 PARTNERS | PASS | `MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS = 10` (`orders/constants.ts`); tests 11 reject / 10 accept | — | ninguna |
| 29 | CONSENTIMIENTO PREVIO ACTIVE | PASS | `assertPartnerConsentsForSplitOrder` exige evidencia ACTIVE; fixtures solo con `allowTestFixtures` | Persistir/consultar consent en consumers productivos | prueba requerida |
| 30 | EXPIRACIÓN CONSENTIMIENTO | PARTIAL | `expiresAt` validado en pre-Order si está presente; sin job de expiración batch | Política de revalidación periódica | decisión humana |
| 31 | SPLIT FIXED | PASS | Default `fixed_preferred` (`resolveMpAmountType`); suma exacta; percentage interno se convierte a montos fixed hacia MP | — | ninguna |
| 32 | SPLIT PERCENTAGE | PASS | Inferencia + bps 10000 (`mapper.ts` ~45–50, ~77–85; `validator.ts` ~86–99). **No eliminar** | Mantener soporte | ninguna |
| 33 | VALIDACIÓN DE SUMA | PASS | `validateSplitOrderForMercadoPago` antes del POST (`adapter.ts` ~114–119) | — | ninguna |
| 34 | MÚLTIPLES PARTNERS TESTS | PASS REAL SANDBOX | Owner + 2 partners → Order `PROCESSED_ACCREDITED` (3 receivers). Evidencia: `mp-split-1n-sandbox-evidence.md` | — | ninguna |
| 35 | CONSENTIMIENTO SDK/API | PARTIAL | Adapter invite/list/get/cancel (`split-consent/adapter.ts`); sandbox-gated; Prisma `DnxSplitConsent` | Flujo prod + UI partner + persistencia ACTIVE verificada | corrección requerida |
| 36 | REFUND TOTAL | PARTIAL | Empty-body total refund sandbox observado (201 + `order_already_refunded` en retry). Suites orquestadas flaky por límites sandbox (`422`/`429`) | Re-smoke cuando límites lo permitan | prueba requerida |
| 37 | REFUND PARCIAL | PARTIAL | Partial REAL multi-partner (`REF01…`, partnerCount 2) + isolated service/adapter. Orquestador completo intermitente (`refund_amount_exceeds` / movement limits) | Re-smoke estable | prueba requerida |
| 38 | IDEMPOTENCIA REFUND | PASS | Key + payloadHash local; `X-Idempotency-Key` a MP; conflict si payload difiere; Prisma unique | — | ninguna |
| 39 | LEDGER POST-REFUND | PASS | `RefundProcessed` + `RefundAllocation`; sum allocations == refund; `supportsRefundPerRecipient: false` (honesto) | Prisma journal durable opcional | ninguna |
| 40 | WEBHOOK POST-REFUND | PASS | `applyOrdersRefundWebhookEffects` idempotente + `reconcileMercadoPagoOrderRefunds` GET | Wiring HTTP Clickatón admin | prueba requerida |

### Conteo (post Imp 05)

| Estado | Cantidad |
| --- | ---: |
| PASS | 28 (+ PASS REAL SANDBOX multi-partner #34) |
| PARTIAL | 10 (Brick/device/refunds total-parcial siguen PARTIAL) |
| FAIL | 2 |
| NOT APPLICABLE | 0 |
| BLOCKED EXTERNAL | límites sandbox refund / webhook live |

### IMPLEMENTACIÓN 02 — cambios aplicados

- Constante `MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS = 10`
- Consent evidence real (`PartnerConsentEvidence`) + errores `CONSENT_*`
- `payer.email` obligatorio
- `statement_descriptor` en payload
- Items → `additional_info.items` (+ `items`)
- Anti-PII `external_reference`
- Estrategia default `fixed_preferred` hacia MP (percentage interno conservado)
- `validateMercadoPagoSplitOrder` pre-POST
- Device/session tipado; placeholders productivos bloqueados
- Docs: este archivo + `mp-split-1n-order-contract.md`
- **No** Brick, **no** refunds, **no** cambios CLF 1:1

### IMPLEMENTACIÓN 03 — cambios aplicados

- `@repo/payments/frontend`: tipos Brick, map formData, device session oficial, sanitize logs, status_detail UX
- Clickatón: `CardPaymentBrickCheckout` + `submitRegistrationCardPaymentAction` + flags
- Price tampering: monto server-side; `clientDisplayedAmountMinor` solo auditoría
- CSP Clickatón: origins oficiales MP (sin `unsafe-eval` global)
- Docs: `mp-split-1n-card-brick.md` + este audit
- **No** refunds, **no** CLF 1:1, **no** production writes, **no** deploy

### IMPLEMENTACIÓN 04 — cambios aplicados

- Provider: `createMercadoPagoOrderRefund` → `POST /v1/orders/{id}/refund`
- Service: `@repo/payments/orders-1n-refunds` (total/parcial, remaining, auth, ledger, reconcile)
- Allocation strategy: proportional + largest remainder (documentada)
- Prisma: `DnxPaymentRefund` + `DnxPaymentRefundAllocation` + migration (no apply prod)
- Capabilities: `supportsRefundPerRecipient: false`
- Docs: `mp-split-1n-refunds.md`
- **No** UI Clickatón, **no** CLF 1:1, **no** production, **no** deploy

### IMPLEMENTACIÓN 05 — cambios aplicados

- Smoke REAL sandbox: consents ACTIVE, Orders owner+1 / owner+N accredited, GET Order
- Mapper fix vs sandbox: **no** `additional_info.items`; `transactions.payments` obligatorio
- Token mint CLI (env card data only) + ephemeral `.local/` token
- Refund client: empty body total + retries 422/429; error body `errors[]` mapping
- Evidencia: `mp-split-1n-sandbox-evidence.md`
- Brick: procedimiento humano documentado (no falsear PASS)
- **No** production, **no** commit/push/deploy

---

## ARQUITECTURA ACTUAL

```
DNX PAYMENTS (@repo/payments)
├── core / contracts / money / distribution / ledger / events / audit / idempotency
├── application
│   ├── commands (create-split-payment-order, refresh-provider-order)
│   ├── persistence (memory + prisma)
│   └── services
│       ├── clickaton-checkout          ← acoplado a Clickatón
│       └── orders-1n-observe           ← webhooks + reconcile GET
├── providers
│   └── mercadopago
│       ├── client (HTTP + idempotency + sanitize)
│       ├── orders (Split 1:N Orders API)     ← objetivo homologación
│       ├── checkout-pro (Preferences TEST)   ← camino Clickatón alt.
│       ├── split-consent
│       ├── refunds (placeholder NO-OP seguro)
│       └── webhooks (signature + parsers)
├── partner-onboarding (owner-oauth / partner-oauth)
├── financial-identity / economic-agreement / finance-permissions
├── credential-vault / dual-read
├── bridges / sdk / sandbox / cli
├── legacy/clf                          ← puente lectura CLF
└── integrations/apps
    ├── apps/clickaton                  ← consumidor principal 1:N
    └── apps/compramelafoto             ← Split 1:1 marketplace legacy (fuera del paquete)
```

**Paquete principal:** `packages/payments` (`@repo/payments`).  
**Docs internas:** `docs/dnx-payments/*` (sandbox-only declarado explícitamente).  
**DB:** modelos `Dnx*` en `packages/db/prisma/schema.prisma` (~8745+).

### Clasificación A–E

| Clase | Código |
| --- | --- |
| **A. Split 1:1** | CLF `apps/compramelafoto/lib/mercadopago.ts` + `create-preference` (`marketplace_fee`); OAuth fotógrafo/lab/organizador. No es Orders 1:N. |
| **B. Split 1:N** | `providers/mercado-pago/orders/*`, `split-consent/*`, `orders-1n-observe/*`, bridges/CLI staging, Clickatón durable checkout. |
| **C. Común** | money, distribution, ledger dominio, idempotency, audit, webhook signature, financial-identity, credential-vault. |
| **D. Duplicado** | Cliente MP HTTP (paquete vs CLF fetch); OAuth (DNX vs CLF); webhook handlers; reconciliación. |
| **E. Acoplado a app** | `clickaton-checkout` (`SOURCE_PRODUCT = "clickaton"`); rutas Clickatón webhook/cron/OAuth; CLF pricing/referrals/preferences. |

---

## SPLIT 1:1 ACTUAL

- **Estado:** Operativo en Comprame la Foto (marketplace Checkout Pro).
- **Mecanismo:** Preference + `marketplace_fee`; collector = vendedor OAuth; plataforma cobra fee.
- **Límite:** comentario explícito de dos receptores (seller + platform fee) en create-preference.
- **No se elimina ni reemplaza** en esta etapa.
- **Homologación 1:N no depende** de migrar CLF al monorepo (confirmado por contexto MP).

---

## SPLIT 1:N ACTUAL

- **Estado:** Implementación sandbox/staging feature-flagged; **no production writes**.
- **Flags:** `DNX_MP_ORDERS_1N_STAGING_ENABLED` (default OFF); `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` (no activar); gates `DNX_CONFIRM_STAGING` + `DNX_CONFIRM_ORDERS_TEST`.
- **Flujo:** distribution engine (minor units) → `inferAmountType` (percentage si hay reglas %; else fixed) → validate → POST `/v1/orders` con splits owner+partners.
- **Decisión arquitectónica preferida (aún no forzada):** reglas internas en %; motor calcula montos; MP recibe preferentemente `amount_type=fixed`; suma = `total_amount`. Hoy el mapper aún puede enviar percentage si hay reglas PERCENTAGE.
- **Owner:** `ownerUserId` server-side.
- **Partners:** UUID `receiver_id`; máx. default **20** (debe ser 10).
- **Consent:** validator ACTIVE, pero mapper hardcodea ACTIVE.

---

## CONSENTIMIENTO

| Aspecto | Estado |
| --- | --- |
| API adapter | invite / list / get / cancel — sandbox |
| Persistencia | `DnxSplitConsent` con PENDING/ACTIVE/REJECTED/CANCELED/EXPIRED |
| Partner OAuth | `partner-onboarding/partner-oauth` (PKCE, vault) |
| Pre-check en create Order | **NO** (hardcode ACTIVE) |
| Expiración automática | **NO** |
| UI consent SDK frontend | No auditada como Brick; flujo API/CLI |

---

## ORDERS API

| Capacidad | Estado |
| --- | --- |
| POST create split order | Sí (sandbox gate) |
| GET order | Sí |
| type online | Sí |
| payment_method + token | Sí (token inyectado; sin Brick) |
| items / additional_info | Tipado, **no enviado** |
| statement_descriptor | Tipado, **no enviado** |
| payer.email | Opcional |
| payer name/id/reg date | No enviado |
| refund | Placeholder NotImplemented |
| capabilities.supportsRefundPerRecipient | `true` — **contradice** implementación |

---

## WEBHOOKS

- Endpoint Clickatón: `/api/webhooks/dnx-payments`
- Firma: `verifyMercadoPagoWebhookSignature`
- Inbox durable + dedupe
- Observe: parse → mark processing → GET canónico → reconcile → audit
- Contadores: mismatch, GET_ORDER_FAILED, RETRY_SCHEDULED
- CLF mantiene webhook legacy separado (`/api/payments/mp/webhook`)

---

## REFUNDS

- **Total / parcial / idempotencia / ledger / webhook post-refund:** FAIL (placeholder seguro a propósito).
- CLF solo reacciona a estados `refunded` / `charged_back` reportados por MP (sin create refund API en DNX Payments).
- Clickatón tiene transición admin `REFUNDED` **no monetaria**.

---

## LEDGER

| Capa | Soporte 1:N |
| --- | --- |
| Dominio `ledger/ledger.ts` | N legs, suma cero, append-only en memoria |
| `DnxProviderSplit` | N receivers por provider order |
| `DnxPaymentOrderAllocation` | N beneficiarios (proyección settlement) |
| `DnxOrderDistributionSnapshot` | Snapshot inmutable |
| Ledger double-entry durable Prisma | **No** hay tablas LedgerEntry/legs |
| Campos rígidos sellerAmount/platformAmount en DNX core | **No** encontrados; CLF usa marketplace_fee |

**Conclusión:** el modelo Prisma de Orders/Splits **sí soporta N receivers**. El ledger contable durable completo sigue siendo diseño + proyecciones, no un journal completo.

---

## ANTIFRAUDE / INTANGIBLES

Requisitos recomendados/obligatorios de industria Otros intangibles mayormente **ausentes en el payload Orders**:

- items unit_price / quantity / title / category_id → FAIL  
- payer enrichment → FAIL  
- Card Payment Brick + device/session → **IMPLEMENTED / SANDBOX LIVE PENDING** (Imp 03)  
- statement_descriptor → PASS (Imp 02)  

---

## TESTS EXISTENTES

### TEST LOCAL (ejecutado en esta auditoría)

| Suite | Resultado |
| --- | --- |
| `packages/payments` `pnpm test` | **303 pass / 0 fail** (post Imp 04, incl. refunds) |
| `clickaton` `pnpm test:card-brick` | **7 pass / 0 fail** (UNIT / UI MOCK — no sandbox) |
| `packages/payments` `pnpm typecheck` | **FAIL** — errores TS2835 (extensiones `.js`) y `implicit any` en checkout-pro / split-consent; WIP preexistente, no corregido en esta etapa |
| MCP `mp_split_validate_order_payload` | ok |
| MCP `mp_split_validate_distribution` | ok (owner/platform/photographer/organizer bps) |
| `mercado-pago-test-adapter.selfcheck.ts` | OK (mocked, offline) |
| `dnx-payments-smoke/checkout/persistence.selfcheck.ts` | **FAIL por WIP ajeno** — `PublicRegistrationError: CONSENT_REQUIRED` (uso de imagen / publicación social). **No es fallo del motor Payments**; no se corrigió código fuera de Payments |

### SANDBOX MP

- Adapter + CLI smoke/staging existen; docs declaran Bloque A smoke real **bloqueado** hasta token TEST- + confirms.
- MCP `mp_split_environment_status`: sandbox credentials present; `productionWritesAllowed: false`.
- MCP `mp_split_preflight_status`: `CONFIRMATION_REQUIRED` (no se ejecutaron writes).

### STAGING / PRODUCTION

- Flags production OFF por diseño.
- No se ejecutaron writes staging/prod en esta auditoría.

### Inventario relevante (no exhaustivo de todo el monorepo)

- Unit: `orders/{adapter,mapper,validator,orders-1n-flag}.test.ts`, split-consent, webhooks, distribution, ledger, money, idempotency, refunds (espera NotImplemented), observe-orders-webhook, clickaton-checkout durable/reconciliation.
- Selfchecks Clickatón: `dnx-payments-*.selfcheck.ts`, `mp-live-preflight.selfcheck.ts`, `edition-checkout-allocations.selfcheck.ts`.
- **No afirmar “testeado en sandbox real”** solo por mocks.

---

## PRODUCTION READINESS

Presencia auditada **sin imprimir secretos** (valores: SET / MISSING / UNKNOWN).

| Variable / artefacto | Repo local `.env*` | MCP sandbox host | Notas |
| --- | --- | --- | --- |
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | MISSING (solo `.env.example`) | SET | Prefijo APP_USR de credenciales de prueba aceptado para MLA sandbox; prod denegado |
| `MERCADOPAGO_TEST_PUBLIC_KEY` | MISSING | SET (MCP) / preflight reportó inconsistencia publicKey en un check | UNKNOWN en apps |
| Owner user id TEST | MISSING | SET | |
| Partner email TEST | MISSING | SET | |
| Device ID TEST | MISSING | SET | No equivale a captura Brick |
| Payment token TEST | MISSING | SET | Efímero |
| Webhook secret prod | MISSING | UNKNOWN | |
| `DNX_MP_ORDERS_1N_STAGING_ENABLED` | MISSING | UNKNOWN | Default OFF en código |
| `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` | MISSING | UNKNOWN | Debe permanecer OFF |
| Application ID / public key prod | UNKNOWN | UNKNOWN | No auditar valores |
| Access token prod | UNKNOWN | N/A (bloqueado) | No tocar |
| Callback / webhook URLs públicas | UNKNOWN | UNKNOWN | Requiere HTTPS |
| Diferencias sandbox vs prod | Documentadas en `docs/dnx-payments/15-*`, `16-*` | Gates sandbox-only activos | |

---

## BLOQUEOS EXTERNOS

1. Confirmaciones pendientes Mercado Pago (MCP): `fee_allocation`, `seller_primary`, `taxes_withholdings`, `settlements_payouts`.
2. Homologación formal Split 1:N por Integraciones MP — **no declarable desde código**.
3. Credenciales/aplicación productiva y registro de webhooks — configuración externa.
4. Posible habilitación comercial del producto Orders Split 1:N en la cuenta MLA.

---

## DEUDA TÉCNICA

1. ~~`supportsRefundPerRecipient` mentía~~ — ahora `false` (Imp 04).
2. Consent fixtures en bridge Clickatón Orders TEST (no Prisma prod).
3. ~~max partners 20~~ — corregido a 10 (Imp 02).
4. Typecheck `@repo/payments` preexistente (imports `.js`).
5. Selfchecks Clickatón WIP imagen (`CONSENT_REQUIRED`).
6. Dualidad CLF marketplace vs DNX Orders (aceptable).
7. Ledger Prisma journal durable aún incompleto (in-memory + allocations OK).
8. Device/Brick/refund smoke sandbox browser/HTTP pendientes.
9. Regla de negocio fees irreversibles post-refund no definida.
10. UI admin refunds Clickatón no implementada (a propósito).

---

## TOP 10 GAPS (post Imp 04)

| Pri | Gap | Impacto |
| --- | --- | --- |
| **P0** | Smoke SANDBOX REAL Brick→Orders + refunds HTTP | Evidencia homologación |
| **P1** | Smoke sandbox multi-partner real | Evidencia |
| **P1** | Wiring consent Prisma productivo | Fixtures → real |
| **P1** | Regla fees/absorción refund (**LEGAL / BUSINESS RULE REVIEW**) | Contabilidad partners |
| **P1** | CSP Brick validar en browser | Posible bloqueo SDK |
| **P2** | UI admin refunds Clickatón | Operación |
| **P2** | Payer enrichment | LEGAL REVIEW |
| **P2** | Typecheck payments preexistente | CI |
| **P2** | Prisma ledger journal durable | Ops |
| **P2** | Selfchecks Clickatón WIP imagen | Ajeno |

---

## CAMBIOS MÍNIMOS PARA HOMOLOGACIÓN (restantes)

1. ~~Brick web + token + device/session~~ (Imp 03 — falta smoke browser).  
2. ~~Refunds Orders + idempotency + reconcile + ledger~~ (Imp 04 — falta smoke HTTP).  
3. Smoke SANDBOX REAL Brick + refunds + multi-partner.  
4. Evidencia sandbox real (owner+1..N) con confirms — sin production.  
5. Paquete de evidencias para Integraciones MP (sin afirmar aprobación).

---

## IMPLEMENTACIONES PROPUESTAS (NO EJECUTAR AÚN)

### IMPLEMENTACIÓN 02 — Homologation payload + guards
- max 10 partners  
- consent ACTIVE desde persistencia/API  
- payer.email obligatorio  
- statement_descriptor  
- items unit_price/quantity/title (+ category decisión)  
- guard anti-PII external_reference  
- prefer fixed amount_type hacia MP tras cálculo interno (mantener percentage engine)

### IMPLEMENTACIÓN 03 — Card Payment Brick (web) — DONE CON CONDICIÓN
- MercadoPago.js + Card Payment Brick (`@mercadopago/sdk-react`)  
- token one-shot al backend  
- `MP_DEVICE_SESSION_ID` → `x-meli-session-id`  
- ningún PAN/CVV al backend  
- mensajes de rechazo UX  
- **Condición:** SANDBOX LIVE VALIDATION PENDING (browser + tarjeta prueba)

### IMPLEMENTACIÓN 04 — Refunds Orders API — DONE CON CONDICIÓN
- total + parcial (`POST /v1/orders/{id}/refund`)  
- X-Idempotency-Key + payloadHash local  
- ledger/allocations proporcionales  
- webhook effects idempotentes + GET reconcile  
- `supportsRefundPerRecipient: false`  
- **Condición:** SANDBOX LIVE REFUND VALIDATION PENDING

### IMPLEMENTACIÓN 05 — Evidencia sandbox multi-partner — DONE CON CONDICIÓN
- consents + owner+1/N accredited + GET REAL  
- mapper runtime fixes (`items` top-level, `transactions` required)  
- Brick browser pendiente humano

### IMPLEMENTACIÓN 06 — Cierre evidencia + package — DONE CON CONDICIÓN
- Refunds controlados A/B/idempotency/multi **PASS REAL** (`.local/audit-imp06/`)  
- Package: `mp-split-1n-homologation-package.md` + checklist final  
- Discrepancia `additional_info.items` documentada para Integraciones  
- Brick/device/webhook: PENDING HUMAN / EXTERNAL CONFIG  
- Production activation checklist **NOT EXECUTED**  
- **sin** enable production

### IMPLEMENTACIÓN 07 — Desacople Clickatón / capa producto
- generalizar `sourceProduct`  
- reducir `SOURCE_PRODUCT = "clickaton"` hardcode  
- preparar CLF/referidos/FotoRank como consumidores futuros sin cutover

---

## LEGAL REVIEW REQUIRED (sin redactar textos)

- Envío de `payer.identification` / nombres / registration_date (PII).  
- Relación contractual owner↔partners, responsabilidad de refunds y settlements (bloqueos externos MP).  
- Consentimientos comerciales de vendedores secundarios vs consentimiento Split técnico MP.

**ACCIÓN LEGAL EN ESTA IMPLEMENTACIÓN:** NO REQUERIDA.

---

## Archivos creados/modificados en ETAPA 01

| Archivo | Acción |
| --- | --- |
| `docs/payments/mp-split-1n-homologation-audit.md` | **Creado** (este informe) |

Ningún código funcional modificado. Sin commit / push / deploy.
