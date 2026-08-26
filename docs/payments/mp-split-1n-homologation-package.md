# Comprame la Foto / DNX Payments

## Mercado Pago Split 1:N — Homologation Package

**Producto técnico:** DNX Payments (`@repo/payments`)  
**Consumer de smoke web (homologación):** Comprame la Foto monorepo — superficie admin aislada (no checkout productivo)  
**Mercado:** Argentina (MLA) · Canal web · Industria Otros intangibles  
**API:** Checkout API / Orders · Split 1:N  
**Fecha paquete:** 2026-07-31 (IMPLEMENTACIÓN 06 + cierre Brick CLF)  
**Production writes:** **BLOCKED** (`DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` ≠ true)

Evidencia detallada: [mp-split-1n-sandbox-evidence.md](./mp-split-1n-sandbox-evidence.md)  
Checklist final: [mp-split-1n-homologation-checklist-final.md](./mp-split-1n-homologation-checklist-final.md)  
**Definiciones oficiales de MP (2026-08-26):** [mp-split-1n-mercadopago-confirmations.md](./mp-split-1n-mercadopago-confirmations.md)  
Prueba live del webhook `order`: [mp-split-1n-webhook-order-live-test.md](./mp-split-1n-webhook-order-live-test.md)

---

### 1. Integration Overview

| Dimensión | Valor |
| --- | --- |
| Country | Argentina / MLA |
| Channel | Web |
| API | Orders API (`POST/GET /v1/orders`, `POST /v1/orders/{id}/refund`) |
| Split | 1:N (owner + hasta 10 partners) |
| Industry | Otros intangibles |
| Checkout UX | Card Payment Brick (`@mercadopago/sdk-react`) |
| Consent | Split Consent API — partner ACTIVE previo al Order |
| Refunds | Total (empty body) + parcial (`transactions[{id,amount}]`) |
| Contingency | GET Order + reconcile local |

---

### 2. Architecture

```
Browser (CLF monorepo homologation surface — admin / flag-gated)
  → Card Payment Brick (@mercadopago/sdk-react + @repo/payments/frontend)
  → CLF TEST server action (scenario server-side; ignores client amount/receivers)
  → @repo/payments Orders adapter
  → POST /v1/orders (+ x-idempotency-key, x-meli-session-id)
  → GET Order reconcile (+ webhook when configured)
  → homologation evidence store (no CLF commercial order / sale)
```

**Separación:** DNX Payments = producto técnico reutilizable. Comprame la Foto monorepo = consumer TEST del smoke Brick (no reemplaza Checkout Pro / `marketplace_fee` 1:1).

Card Payment Brick validated through a protected sandbox homologation surface in Comprame la Foto monorepo using the shared DNX Payments integration — **not** via Clickatón product checkout.

---

### 3. Consent Flow

```
Partner TEST account
  → Split Consent invite / accept
  → status ACTIVE (provider)
  → receiver UUID usable en splits[]
  → Order create gated on ACTIVE evidence (no hardcode)
```

Sandbox: partners A/B ACTIVE reales (prefijos sanitizados en evidencia).

---

### 4. Payment Flow

1. Brick tokeniza tarjeta TEST (browser).  
2. Backend recibe token + `deviceSessionId` (nunca PAN/CVV).  
3. Monto/eligibilidad reconstruidos server-side.  
4. Payload Orders: `type=online`, `payer.email`, `items` top-level, `transactions.payments`, `splits` fixed, `statement_descriptor`.  
5. Respuesta: `processed` + `accredited` (sandbox observado).  
6. Observabilidad: webhook firmado y/o GET Order.

---

### 5. Split Rules

- Estrategia hacia MP: **`fixed_preferred`** (montos exactos).  
- Suma allocations == `total_amount`.  
- Máximo **10** partners.  
- Owner `receiver_type=owner` (server-side).  
- Partners requieren consentimiento ACTIVE.

---

### 6. Sandbox Evidence

| Caso | Resultado |
| --- | --- |
| Consent partner A | PASS REAL |
| Consent partner B | PASS REAL |
| Owner + 1 | PASS REAL |
| Owner + 2 | PASS REAL |
| GET Order | PASS REAL |
| Card Brick browser | **PASS REAL** — CLF monorepo homologation (`CLF_CARD_BRICK_HOMOLOGATION`, Owner+2, accredited) |
| Device ID (browser / `x-meli-session-id`) | **PASS REAL** (`DEVICE_SESSION_PRESENT=true`, Brick CLF) |
| Partial refund (Order dedicada) | PASS REAL (Imp 06 case A) |
| Total refund (Order dedicada) | PASS REAL (Imp 06 case B) |
| Idempotency refund retry | PASS REAL (`sameProviderRefundId`) |
| Multi-partner refund | PASS REAL (Imp 06 case multi) |
| Webhook live | **PENDING** — endpoint público de staging verificado; falta el registro en el panel de MP (paso externo) |
| GET contingency | PASS |

Artefactos locales (gitignored): `.local/audit-imp05/`, `.local/audit-imp06/`, `.local/audit-clf-brick/`.

---

### 7. Security

- Tokenización exclusiva Mercado Pago (Brick / card_tokens TEST).  
- Sin PAN/CVV en backend DNX.  
- Access token solo server-side.  
- Idempotency keys en create/refund.  
- `external_reference` anti-PII.  
- Logs sanitizados (`tokenPresent`, `DEVICE_SESSION_PRESENT`, sin secretos).  
- CSP con origins oficiales MP (sin `script-src *` / sin `unsafe-eval` global).

---

### 8. Refunds

| Modo | Implementación | Sandbox |
| --- | --- | --- |
| Parcial | `transactions[{id,amount}]` | PASS (Orders separadas) |
| Total | empty body | PASS |
| Idempotencia | key + store local + misma key MP | PASS (`sameProviderRefundId`) |
| Ledger | `RefundProcessed` + allocations proporcionales | PASS unit + smoke local |
| Breakdown receivers | **no** observado en respuesta MP | DNX accounting interno documentado |

**PROVIDER FACT:** la respuesta de refund no incluye breakdown por receiver.  
**DNX INTERNAL ACCOUNTING:** `PROPORTIONAL_TO_ORIGINAL_SPLITS_LARGEST_REMAINDER` (no afirmamos que MP use la misma fórmula).

---

### 9. Webhook + Contingency

| Pieza | Estado |
| --- | --- |
| **Tópico Orders** | **`order`** — confirmado por MP (2026-08-26). `payment` queda para Checkout Pro / arquitectura anterior. |
| **Fuente de verdad** | **GET `/v1/orders/{id}`** — confirmado por MP. El webhook es sólo disparador de notificación, nunca decide. |
| Endpoint | `POST /api/webhooks/dnx-payments` (Clickatón) |
| Firma | HMAC DNX / headers MP `x-signature` |
| Observe flag | `DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED` |
| Staging URL pública | **`https://clickaton-staging.vercel.app/api/webhooks/dnx-payments`** — preflight PASS 2026-08-26 (HTTPS, sólo POST, rechaza unsigned, verifica firma) |
| Registro en panel MP con tópico `order` | **PENDING EXTERNAL CONFIG** (paso humano) |
| Secreto de firma MP | `MERCADOPAGO_WEBHOOK_SECRET`, separado del HMAC interno DNX (2026-08-26) |
| Observación live | **WEBHOOK NOT OBSERVED** |
| Contingencia | **GET Order = PASS** |

---

### 10. Known Runtime Findings

#### DOCUMENTATION / RUNTIME DISCREPANCY — items intangibles

| | |
| --- | --- |
| **CHECKLIST EXPECTATION** | Datos de item (unit_price / quantity) para industria Otros intangibles, frecuentemente documentados bajo `additional_info.items`. |
| **SANDBOX OBSERVATION** | En Orders Split 1:N, `additional_info.items` fue **rechazado** (`unsupported_properties` / additionalProperties). |
| **CURRENT IMPLEMENTATION** | `items[]` **top-level** + `transactions.payments` obligatorio; sin `additional_info.items`. |
| **QUESTION FOR MP** | Confirmar ubicación/formato correcto de información antifraude de items en Orders API Split 1:N (MLA / intangibles). |
| **RESPUESTA MP (2026-08-26)** | **RESUELTO.** `items[]` va en el nivel superior del body; `additional_info.items` está **deprecado** para Orders API. Nuestra implementación top-level es correcta. `category_id: "others"` es válido; `virtual_goods` es **sugerido** (no obligatorio) para fotografías digitales. Ver [confirmaciones de MP](./mp-split-1n-mercadopago-confirmations.md). |

Otros hallazgos sandbox:

1. `transactions.payments` obligatorio en create online.  
2. Total refund: body vacío (string vacío / omit body canónico).  
3. Errores frecuentes en nodo `errors[]`.  
4. Límites/intermitencia 422/429 en secuencias largas de refunds — smokes deben ser Orders separadas y pausadas.

---

### 11. Open Questions for Mercado Pago

#### A. INTEGRATION QUESTIONS

1. ~~Ubicación/formato correcto de información de items para intangibles (ver §10).~~ **RESPONDIDA 2026-08-26** — `items[]` top-level; `additional_info.items` deprecado.  
2. ~~Comportamiento esperado de webhooks Orders~~ **RESPONDIDA 2026-08-26** — tópico `order`; el webhook no es fuente de verdad; el flujo correcto es webhook → `data.id` → GET Order → decisión. Sigue pendiente el registro de la URL pública (paso externo).  
3. ¿Existe breakdown de receivers en refund response? (nosotros no lo observamos).  
4. **ABIERTA** — ¿Una única aplicación habilitada para Split (1 a N) puede representar a DNX Payments para varios productos? MP está consultando internamente. `integrator_id` mencionado como posible agrupador: **NO adoptado** hasta confirmación formal.

#### B. SETTLEMENT / BUSINESS QUESTIONS

4. `fee_allocation`  
5. `seller_primary`  
6. `taxes_withholdings`  
7. `settlements_payouts`  
8. Reversión de fees en refunds  
9. Quién absorbe fees no reversibles  
10. Tratamiento fiscal de refunds/partners  

**LEGAL / BUSINESS RULE REVIEW REQUIRED** (DNX) — no bloquea revisión técnica de Integraciones.

---

### 12. Production Safety

| Control | Estado |
| --- | --- |
| `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` | OFF / not true |
| HTTP client production writes | blocked |
| MCP `productionWritesAllowed` | false |
| Deploy producción en Imp 06 | **NOT EXECUTED** |

---

### 13. Requested Review

Solicitamos al equipo de **Integraciones de Mercado Pago** la validación técnica del flujo Orders Split 1:N (MLA, web, Brick, consents, refunds, GET contingency) sobre evidencia sandbox, y respuesta a las preguntas de §10–§11, para habilitar el go-live **después** de aprobación formal.

**No** se declara homologación aprobada ni production-ready en este paquete.

---

### Appendix — PRODUCTION ACTIVATION CHECKLIST (NOT EXECUTED)

| Paso | Estado |
| --- | --- |
| Production credentials | NOT EXECUTED |
| Production application | NOT EXECUTED |
| Owner user ID production | NOT EXECUTED |
| Production partner consents | NOT EXECUTED |
| Callback / return URLs production | NOT EXECUTED |
| Webhook production registered | NOT EXECUTED |
| Feature flags production ON | NOT EXECUTED |
| DB migrations apply production | NOT EXECUTED |
| Deploy production | NOT EXECUTED |
| First low-value live transaction | NOT EXECUTED |
| Monitoring / alerts | NOT EXECUTED |
| Rollback plan exercised | NOT EXECUTED |
