# Mercado Pago Split 1:N — Sandbox Evidence

**Etapa:** IMPLEMENTACIÓN 05 + 06  
**Fecha:** 2026-07-31  
**Ambiente:** Mercado Pago TEST / sandbox (MLA)  
**Production writes:** OFF (`DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` ≠ true)  
**Artefactos locales (gitignored):** `.local/audit-imp05/`, `.local/audit-imp06/`  
**Package:** [mp-split-1n-homologation-package.md](./mp-split-1n-homologation-package.md)

---

## Environment

| Check | Result |
| --- | --- |
| MP API base | Official `https://api.mercadopago.com` |
| Access token | SET (TEST / Credenciales de prueba, APP_USR- sandbox-eligible) |
| Public key | SET (TEST panel) |
| Owner receiver | SET (numeric TEST owner) |
| Partner A receiver | SET (UUID, consent ACTIVE) |
| Partner B receiver | SET (UUID, consent ACTIVE) |
| Device session env | SET (`MERCADOPAGO_TEST_DEVICE_ID`) |
| Payment token env | Ephemeral mint via `/v1/card_tokens` (single-use) |
| Orders 1:N flags | Staging/test confirms required for writes |
| Card Brick flags | Implemented; browser smoke pending human |
| Refunds flags | Adapter + service unit-tested; sandbox HTTP exercised |
| Production writes | OFF |

CLI:

```bash
pnpm --filter @repo/payments exec tsx src/cli/imp05-sandbox-evidence.ts --preflight
# with official TEST card env (never commit PAN/CVV):
pnpm --filter @repo/payments exec tsx src/cli/imp05-sandbox-evidence.ts --run \
  --confirm-staging --confirm-orders-test --confirm-refund-smoke
```

---

## Safety Gates

- `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` must not be true → ABORT.
- HTTP client blocks production environment writes.
- MCP `productionWritesAllowed: false`.
- No production access token / public key used.

---

## Consent Evidence

Real remote GET (not fixtures):

| Partner | Receiver prefix | Status | Fixture? |
| --- | --- | --- | --- |
| partner_A | `748d158f…` | ACTIVE | no |
| partner_B | `52a3dbe1…` | ACTIVE | no |

Source: `.local/audit-imp05/01-consents.json`

---

## Card Brick Evidence

### CLI / API token path (Imp 05)

Backend order create used Mercado Pago public `POST /v1/card_tokens` with official TEST cards (env-only; not stored in repo). That validates Orders + token path, **not** the Brick UI.

### CLF MONOREPO CARD BRICK HOMOLOGATION

**Status:** PASS REAL SANDBOX (2026-07-31)

Card Payment Brick validated through a protected sandbox homologation surface in Comprame la Foto monorepo using the shared DNX Payments integration (not Clickatón product checkout).

| Field | Value |
| --- | --- |
| Consumer surface | Comprame la Foto monorepo (isolated admin homologation) |
| Product | DNX Payments (`@repo/payments`) |
| Route | `/admin/homologacion-mp-split-1n` |
| Flag | `DNX_CLF_MP_SPLIT_1N_HOMOLOGATION_ENABLED` |
| Source metadata | `CLF_CARD_BRICK_HOMOLOGATION` |
| Environment | SANDBOX |
| Production | BLOCKED |
| Brick loaded | PASS |
| Device present (official browser session / `armor.*` + `x-meli-session-id`) | PASS (`DEVICE_SESSION_PRESENT=true`, len=231) |
| Scenario | Owner + 2 partners |
| partnerCount | 2 (receiverCount = 3 con owner) |
| amountType | fixed |
| splitSumValid | true |
| Provider status | `PROCESSED_ACCREDITED` / `accredited` |
| Accredited | PASS |
| GET reconcile | PASS (`smoke:clf-brick-verify` ok=true) |
| Order id prefix | `ORDTST01KYWX…` |
| Payment id prefix | `PAY01KYWX8E2…` |
| CSP | PASS (origins oficiales incl. `secure-fields.mercadopago.com`, `www.mercadolibre.com`) |
| CLF Checkout Pro / marketplace_fee | UNTOUCHED |
| CLF commercial sale / email / download | NOT CREATED |
| Artefactos | `.local/audit-clf-brick/` (gitignored) |
| Verificador | `pnpm --filter @repo/payments smoke:clf-brick-verify` |

---

## Device Session Evidence

| Item | Result |
| --- | --- |
| Header `x-meli-session-id` on Order create | PRESENT (CLI smokes + CLF Brick browser) |
| Official Brick browser device session | PASS REAL — `DEVICE_SESSION_PRESENT=true` (CLF homologation; armor session propagated, no fabricated UUID) |

Browser Brick + device: **PASS REAL SANDBOX**.

---

## Order Owner + 1 Partner

| Field | Evidence |
| --- | --- |
| HTTP | 201 |
| Status | `PROCESSED_ACCREDITED` / `processed` + `accredited` |
| Partners | 1 |
| totalMinor | 10000 |
| allocationMatch | true |
| external_reference | `imp05-o1-…` (opaque) |
| payer.email | masked `bu…@testuser.com` |
| statement_descriptor | `DNX TEST` |
| x-idempotency-key | present |
| x-meli-session-id | present |
| Order id prefix | `ORDTST01…` |
| Payment id prefix | `PAY01…` |

Source: `.local/audit-imp05/02-order-owner-plus-1.json`

---

## Order Owner + N Partners

| Field | Evidence |
| --- | --- |
| HTTP | 201 |
| Status | `PROCESSED_ACCREDITED` |
| Partners | **2** (owner + A + B → 3 receivers) |
| totalMinor | 15000 |
| allocationMatch | true |
| MP accepted multi splits | yes (`splits` length 3 in create response) |

Source: `.local/audit-imp05/03-order-owner-plus-n.json`

---

## GET Order Evidence

After each create, adapter `getOrder` confirmed:

- same provider order id
- status `PROCESSED_ACCREDITED`
- status_detail `accredited`
- payment transaction present
- amounts match local total

---

## Webhook Evidence

**WEBHOOK NOT OBSERVED** during this CLI window (no public staging webhook capture in-process).

**GET RECONCILIATION SUCCESS** path implemented and exercised via `getOrder` after create / refund attempts.

---

## Partial Refund Evidence

Observed REAL sandbox refunds (not mocks):

1. Multi-partner partial via `POST /v1/orders/{id}/refund` → provider refund id prefix `REF01KYWHMPR…`, `partnerCount: 2`  
   Source: `.local/audit-imp05/05-multipartner-refund.json`
2. Isolated adapter + service partial (`amountMinor: 1000`) → `PROCESSED` (debug session same day).

Orchestrated full partial→retry→remaining in one CLI run is **flaky** under sandbox limits:

- `422` `Post processing rejected the operation.`
- `429` movement limit
- intermittent `400` `refund_amount_exceeds`

Classification: **PROVIDER SANDBOX LIMIT / EVENTUAL CONSISTENCY** (not treated as local contract bug when payload matches docs).

---

## Idempotency Retry Evidence

- Same `X-Idempotency-Key` retry after successful refund → provider does not create a second logical refund (`order_already_refunded` / same refund id observed in debug).
- Local store designed for single record per key; unit tests cover payload conflict.

---

## Full/Remaining Refund Evidence

- Empty-body total refund (`emptyBody: ""`) returned HTTP 201; subsequent attempt → `order_already_refunded`.
- Adapter updated to send empty body for total refunds (Imp 05 correction).
- Remaining-after-partial path implemented; sandbox rate limits blocked some orchestrated completions.

---

## Reconciliation Evidence

- `reconcileMercadoPagoOrderRefunds()` implemented (GET Order vs local refunds).
- When refunds persist locally after successful HTTP, reconciliation returns matched counts.
- When sandbox rejects refund writes, reconciliation N/A for that run.

---

## Homologation payload snapshot (sanitized)

Real successful create shape (secrets redacted):

```json
{
  "type": "online",
  "external_reference": "imp05-o1-[opaque]",
  "payer": { "email": "bu…@testuser.com" },
  "items": [{ "title": "Imp05 sandbox intangible", "quantity": 1, "unit_price": "[money]" }],
  "total_amount": "[money]",
  "processing_mode": "automatic",
  "transactions": {
    "payments": [{
      "amount": "[money]",
      "payment_method": {
        "id": "master",
        "type": "credit_card",
        "token": "[REDACTED]",
        "installments": 1,
        "statement_descriptor": "DNX TEST"
      }
    }]
  },
  "splits": [
    { "receiver_type": "owner", "amount": "[money]" },
    { "receiver_type": "partner", "amount": "[money]" }
  ],
  "config": { "split_rules": { "amount_type": "fixed" } },
  "headers": {
    "x-idempotency-key": "[present]",
    "x-meli-session-id": "[present]",
    "x-test-token": "[present]"
  }
}
```

---

## Imp 06 — Controlled refunds (separate Orders)

CLI: `pnpm --filter @repo/payments smoke:imp06-controlled-refunds -- --case=A|B|idempotency|multi …`

| Case | Result | Artifact |
| --- | --- | --- |
| A — partial only | PASS REAL (`REF01…`, reconcile `needsAttention: false`) | `.local/audit-imp06/case-A.json` |
| B — total empty body | PASS REAL (`fullyRefunded: true` local) | `.local/audit-imp06/case-B.json` |
| idempotency retry | PASS REAL (`sameProviderRefundId: true`) | `.local/audit-imp06/case-idempotency.json` |
| multi-partner partial | PASS REAL (partnerCount 2; no MP receiver breakdown) | `.local/audit-imp06/case-multi.json` |

Production writes: **BLOCKED** in every report.

---

## Imp 06 — Card Brick / Device / Webhook

| Item | Result |
| --- | --- |
| Card Brick browser | **HUMAN BROWSER STEP REQUIRED** — procedure: `apps/clickaton/scripts/card-brick-sandbox-smoke.md` · verify: `smoke:imp06-brick-verify` |
| Local Clickatón Brick flags | MISSING in `apps/clickaton/.env.local` (must set before human smoke) |
| Device Brick `MP_DEVICE_SESSION_ID` | PENDING HUMAN; logs emit `DEVICE_SESSION_PRESENT` only |
| CSP | Configured with official MP origins (`apps/clickaton/next.config.ts`); browser CSP PASS pending human console check |
| Webhook | **WEBHOOK CONFIGURATION EXTERNAL STEP REQUIRED** / **WEBHOOK NOT OBSERVED** |
| GET contingency | PASS |

---

## DOCUMENTATION / RUNTIME DISCREPANCY — items

See homologation package §10. Summary: checklist expects item antifraud fields often under `additional_info.items`; sandbox Orders Split 1:N **rejected** that node; DNX sends top-level `items[]`.

---

## Known Gaps

1. Card Payment Brick browser smoke not completed (human card input + flags locales).
2. Official Brick device session not confirmed.
3. Webhook live delivery not observed (URL/observe flag config externa).
4. Sandbox refund rate limits if smokes are chained aggressively (mitigated by separate Orders).
5. MP does not return per-receiver refund breakdown.

---

## External MP Questions

### A. INTEGRATION

1. Items intangibles location/format.  
2. Webhook Orders/refunds registration behavior.  
3. Refund receiver breakdown (if any).

### B. SETTLEMENT / BUSINESS

fee_allocation · seller_primary · taxes_withholdings · settlements_payouts · fee reversal · who absorbs fees · fiscal treatment.

**LEGAL / BUSINESS RULE REVIEW REQUIRED** (not modified in Imp 05/06).

---

## TECHNICAL HOMOLOGATION READINESS

**READY FOR MP REVIEW WITH EXTERNAL QUESTIONS**

Not declaring Mercado Pago approved — Integraciones must review.
