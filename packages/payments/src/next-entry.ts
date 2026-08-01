/**
 * Entry compatible con Next/Turbopack (imports sin sufijo .js).
 * Usar desde apps Next: `@repo/payments/next`.
 */
export { createInMemoryDnxPaymentsPersistence } from "./application/persistence/memory";
export type { DnxPaymentsPersistence } from "./application/persistence/ports";
export {
  createPrismaDnxPaymentsPersistence,
  type DnxPaymentsPrismaDelegates,
} from "./infrastructure/prisma/persistence";
export {
  createClickatonCheckoutService,
  type ClickatonCheckoutService,
} from "./application/services/clickaton-checkout/clickaton-checkout-service";
export type { ClickatonOperationalSnapshotHook } from "./application/services/clickaton-checkout/clickaton-checkout-service";
export type {
  DurableCheckoutOrder,
  NormalizedCheckoutEvent,
  CreateClickatonCheckoutOrderInput,
  CreateClickatonCheckoutOrderResult,
  ApplyNormalizedCheckoutEventResult,
  ReconcileClickatonCheckoutResult,
  NormalizedCheckoutStatus,
  ClickatonCheckoutProviderBridge,
} from "./application/services/clickaton-checkout/types";
export {
  validateMercadoPagoTestCredentials,
  createMercadoPagoCheckoutProTestAdapter,
  createMercadoPagoCheckoutProLiveAdapter,
  createMercadoPagoTestClickatonProviderBridge,
  createMercadoPagoProductionClickatonProviderBridge,
  resolveClickatonPaymentsProviderMode,
  mapMercadoPagoPaymentStatusToNormalized,
  sanitizeMercadoPagoPreferenceResponse,
  assertNoSecretLeak,
} from "./providers/mercado-pago/checkout-pro";
export {
  verifyMercadoPagoWebhookSignature,
  parseMercadoPagoSignatureHeader,
  buildMercadoPagoWebhookManifest,
  normalizeMercadoPagoDataId,
} from "./providers/mercado-pago/webhooks/signature";
export {
  parseMercadoPagoPaymentNotification,
  extractMercadoPagoDataId,
} from "./providers/mercado-pago/webhooks/payment-notification";
export {
  parseMercadoPagoOrdersNotification,
  isMercadoPagoOrdersWebhookType,
} from "./providers/mercado-pago/webhooks/orders-notification";
export {
  observeOrdersWebhook,
  createOrdersObserveCounters,
} from "./application/services/orders-1n-observe";
export type { FetchCanonicalOrder } from "./application/services/orders-1n-observe";
export {
  ORDERS_1N_WEBHOOK_OBSERVE_FLAG,
  isOrders1nWebhookObserveEnabled,
} from "./providers/mercado-pago/orders/orders-1n-observe-flag";
export {
  ORDERS_1N_STAGING_FLAG,
  isOrders1nStagingFlagEnabled,
  assertOrders1nStagingCreateAllowed,
} from "./providers/mercado-pago/orders/orders-1n-flag";
export {
  CLICKATON_DNX_CHECKOUT_FLAG,
  isClickatonDnxCheckoutEnabled,
  assertClickatonDnxCheckoutAllowed,
  CLICKATON_MP_LIVE_PAYMENTS_FLAG,
  isClickatonLivePaymentsEnabled,
  isClickatonProductionRuntime,
  resolveClickatonPaymentsProviderModeControlled,
  assertLivePaymentsExecutionAllowed,
  preflightClickatonLivePayments,
  buildClickatonOperationalSnapshot,
  CLICKATON_STAGING_AGREEMENT_SCOPE,
  createMercadoPagoOrders1nClickatonBridge,
  fulfillRegistrationFromOrdersObserve,
} from "./application/services/clickaton-checkout";
export type {
  LivePaymentsPreflightResult,
  ClickatonPaymentsProviderMode,
} from "./application/services/clickaton-checkout";
export type {
  OperationalSnapshotResult,
  Orders1nRegistrationBridgeDeps,
  FulfillFromOrdersObserveResult,
} from "./application/services/clickaton-checkout";
export type { CheckoutEventOrigin } from "./application/services/clickaton-checkout/types";
export { MercadoPagoHttpClient } from "./providers/mercado-pago/client/mercado-pago-http-client";
export { createMercadoPagoProviderConfig } from "./providers/mercado-pago/client/mercado-pago-environment";
export { MercadoPagoOrdersAdapter } from "./providers/mercado-pago/orders/adapter";
export { isSandboxAccessToken } from "./providers/mercado-pago/client/mercado-pago-environment";
export { loadSandboxEnvFromProcess } from "./sandbox/preflight";
export {
  buildOrdersWebhookFixtureBody,
  signMercadoPagoTestWebhook,
} from "./providers/mercado-pago/webhooks/sign-test-fixture";
export { mapMercadoPagoOrderResponse } from "./providers/mercado-pago/orders/mapper";
export {
  createOrders1nRefundService,
  InMemoryRefundStore,
  reconcileMercadoPagoOrderRefunds,
  applyOrdersRefundWebhookEffects,
  allocateRefundProportionally,
  getRefundableAmount,
  assertRefundAuthorized,
  REFUND_ALLOCATION_STRATEGY,
} from "./application/services/orders-1n-refunds";
export type {
  RefundRequest,
  RefundResult,
  RefundableBalance,
  Orders1nRefundService,
} from "./application/services/orders-1n-refunds";
export {
  EDITION_CHECKOUT_BPS_TOTAL,
  allocateByBasisPoints,
  planEditionCheckoutFromSnapshot,
  validateEditionCheckoutSnapshot,
  reconcileAllocationsWithConfirmedFee,
  extractProviderFeeMinorFromMpPayment,
  EditionCheckoutAllocationError,
} from "./edition-checkout/index.js";
export type {
  EditionCheckoutFinanceSnapshot,
  EditionCheckoutSnapshotAllocation,
  PlannedEditionCheckout,
} from "./edition-checkout/index.js";

