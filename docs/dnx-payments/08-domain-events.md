# 08 — Domain events

## Convención

- Pasado (`PaymentApproved`, no `ApprovePayment`).
- Payload inmutable, sin secretos.
- Incluyen `eventId`, `occurredAt`, `aggregateType`, `aggregateId`, `productId?`.

## Catálogo

| Evento | Cuándo |
|---|---|
| `PaymentIntentCreated` | Intent creado |
| `PaymentIntentReady` | Pasó validaciones |
| `DistributionCalculated` | Plan calculado |
| `DistributionLocked` | Plan inmutable pre-submit |
| `ProviderOrderCreated` | Adapter creó orden |
| `PaymentAttemptStarted` | Submit iniciado |
| `PaymentAttemptFailed` | Fallo técnico/negocio |
| `PaymentApproved` | Fondos acreditados / order processed |
| `PaymentRejected` | Rechazo |
| `RefundRequested` | Alta de refund |
| `RefundProcessed` | Confirmado por provider |
| `ChargebackReceived` | Aviso de chargeback |
| `ChargebackResolved` | Won/Lost/Closed |
| `LedgerPosted` | Journal append |
| `SettlementGenerated` | Lote de settlement |
| `SettlementApproved` | Ops aprobó |
| `PayoutCompleted` | Dinero enviado |
| `WebhookReceived` | Inbox |
| `WebhookProcessed` | Side-effects aplicados |
| `ReconciliationCompleted` | Run terminó |
| `SplitConsentUpdated` | Cambio de estado consent |

## Commands (entrada)

| Command | Efecto esperado |
|---|---|
| `CreatePaymentIntent` | → Intent + event |
| `CalculateDistribution` | → Plan |
| `SubmitPaymentIntent` | → ProviderOrder |
| `ProcessProviderWebhook` | → estado order + ledger |
| `RequestRefund` | → Refund |
| `OpenSettlement` | → Settlement |

Los commands viven en contratos; handlers se implementan en Etapa 03+.

## Outbox (futuro)

Publicación confiable hacia productos (CLF “marcar PAID”) vía outbox — no implementado aquí.
