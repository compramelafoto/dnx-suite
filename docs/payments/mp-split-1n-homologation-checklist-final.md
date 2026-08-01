# Mercado Pago Split 1:N — Homologation Checklist Final (Imp 06)

**Fecha:** 2026-07-31  
**Package:** [mp-split-1n-homologation-package.md](./mp-split-1n-homologation-package.md)  
**Evidence:** [mp-split-1n-sandbox-evidence.md](./mp-split-1n-sandbox-evidence.md)

Estados usados: **PASS** · **PARTIAL** · **EXTERNAL QUESTION** · **PENDING HUMAN** · **READY FOR MP REVIEW**

---

## Matriz final

| Requisito | Código | Test | Sandbox Real | Estado |
| --- | --- | --- | --- | --- |
| Consent ACTIVE | IMPLEMENTED | PASS UNIT | PASS REAL | PASS |
| Owner + 1 Order | IMPLEMENTED | PASS UNIT | PASS REAL | PASS |
| Owner + N (≥2 partners) | IMPLEMENTED | PASS UNIT | PASS REAL | PASS |
| GET Order contingency | IMPLEMENTED | PASS UNIT | PASS REAL | PASS |
| Card Payment Brick | IMPLEMENTED (CLF monorepo homologation surface) | PASS UNIT | PASS REAL SANDBOX (Owner+2 accredited) | PASS |
| Device session (`armor.*` / `x-meli-session-id`) | IMPLEMENTED | PASS UNIT | PASS REAL SANDBOX (Brick browser) | PASS |
| Order from Browser Brick | IMPLEMENTED | PASS | PASS REAL (`CLF_CARD_BRICK_HOMOLOGATION`) | PASS |
| Owner + N via Browser | IMPLEMENTED | PASS | PASS REAL (CLI + Browser) | PASS |
| CSP CLF Brick origins | IMPLEMENTED | — | PASS (console + frames) | PASS |
| `x-meli-session-id` header | IMPLEMENTED | PASS | PASS (Orders create) | PASS |
| Items intangibles | IMPLEMENTED/ADAPTED (top-level `items`) | PASS | RUNTIME DISCREPANCY vs checklist `additional_info.items` | EXTERNAL QUESTION |
| `transactions.payments` | IMPLEMENTED | PASS | PASS REAL | PASS |
| Partial refund | IMPLEMENTED | PASS UNIT | PASS REAL (Imp 06 case A) | PASS |
| Total refund | IMPLEMENTED | PASS UNIT | PASS REAL (Imp 06 case B) | PASS |
| Refund idempotency | IMPLEMENTED | PASS UNIT | PASS REAL (`sameProviderRefundId`) | PASS |
| Multi-partner refund | IMPLEMENTED | PASS UNIT | PASS REAL (Imp 06 multi) | PASS |
| Refund receiver breakdown | N/A provider | — | NOT OBSERVED | EXTERNAL QUESTION |
| Webhook Orders | IMPLEMENTED | PASS UNIT | NOT OBSERVED (config externa) | READY FOR MP REVIEW |
| Ledger / reconcile | IMPLEMENTED | PASS UNIT | PASS (local + GET) | PASS |
| Production writes | BLOCKED | PASS | PASS | PASS |
| Anti-PII external_reference | IMPLEMENTED | PASS | PASS | PASS |
| Idempotency create | IMPLEMENTED | PASS | PASS | PASS |
| fee_allocation / settlements | — | — | — | EXTERNAL QUESTION |
| Legal fees / partners | — | — | — | EXTERNAL QUESTION (LEGAL REVIEW) |

---

## Resumen de conteo

| Estado | Cantidad aprox. |
| --- | ---: |
| PASS | Orders/refunds/consent + Brick browser + device |
| EXTERNAL QUESTION | items location, fee/settlement, refund breakdown |
| READY FOR MP REVIEW / PENDING EXTERNAL | webhook live observation |

---

## Criterio de cierre Imp 06 + Brick CLF

| Ítem | Resultado |
| --- | --- |
| Card Brick browser real | **PASS REAL SANDBOX** (CLF monorepo homologation) |
| Device browser oficial | **PASS REAL SANDBOX** |
| Owner + N (CLI + Browser) | **PASS REAL SANDBOX** |
| Refunds controlados A/B/idem/multi | **PASS REAL** |
| Package homologación | **UPDATED** (Brick vía CLF, no Clickatón) |
| Production | **OFF / BLOCKED** |
| Webhook live | **PENDING** (externo) |

**CIERRE BRICK CLF:** DONE CON CONDICIÓN (webhook externo pendiente)  

**TECHNICAL READINESS:** READY FOR MP REVIEW WITH EXTERNAL QUESTIONS
