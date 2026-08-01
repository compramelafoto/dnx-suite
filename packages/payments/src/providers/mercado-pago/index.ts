export { MERCADOPAGO_ORDERS_CAPABILITIES } from "./capabilities.js";

export { createMercadoPagoProviderConfig } from "./client/mercado-pago-environment.js";
export type { MercadoPagoProviderConfig, MercadoPagoEnvironment } from "./client/mercado-pago-environment.js";
export {
  assertSandboxWriteAllowed,
  assertSandboxToken,
  isTestAccessToken,
  isSandboxAccessToken,
  MP_API_BASE_URL,
  CURRENCY_DECIMAL_SCALE,
} from "./client/mercado-pago-environment.js";
export { MercadoPagoHttpClient } from "./client/mercado-pago-http-client.js";
export type { MercadoPagoRequestOptions } from "./client/mercado-pago-request.js";
export type { ParsedMpResponse, Rfc7807Problem } from "./client/mercado-pago-response.js";
export { moneyToMercadoPagoAmount, percentageBpsToMercadoPagoAmount } from "./money-mapper.js";
export { mapMercadoPagoHttpError, isRetryableStatus } from "./errors/error-mapper.js";
export { MercadoPagoSplitConsentAdapter } from "./split-consent/adapter.js";
export { MercadoPagoOrdersAdapter } from "./orders/adapter.js";
export type { MercadoPagoOrdersAdapterOptions, CreateSplitOrderInput } from "./orders/adapter.js";
export {
  ORDERS_1N_STAGING_FLAG,
  isOrders1nStagingFlagEnabled,
  assertOrders1nStagingCreateAllowed,
} from "./orders/orders-1n-flag.js";
export type { Orders1nGateDenial, Orders1nGateInput } from "./orders/orders-1n-flag.js";
export {
  ORDERS_1N_WEBHOOK_OBSERVE_FLAG,
  isOrders1nWebhookObserveEnabled,
} from "./orders/orders-1n-observe-flag.js";
export {
  validateSplitOrderForMercadoPago,
  validateMercadoPagoSplitOrder,
  assertDeviceSessionId,
} from "./orders/validator.js";
export {
  MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS,
  DEFAULT_MP_SPLIT_AMOUNT_TYPE_STRATEGY,
  MERCADO_PAGO_STATEMENT_DESCRIPTOR_MAX_LENGTH,
} from "./orders/constants.js";
export type { MpSplitAmountTypeStrategy } from "./orders/constants.js";
export {
  assertPartnerConsentsForSplitOrder,
  testActivePartnerConsent,
  ConsentRequiredError,
  ConsentExpiredError,
} from "./orders/consent-evidence.js";
export type { PartnerConsentEvidence } from "./orders/consent-evidence.js";
export {
  validateOrderItems,
  mapOrderItemsToMercadoPago,
  singleIntangibleItem,
  sumOrderItemsMinor,
} from "./orders/order-items.js";
export type { OrderItemInput, ItemsTotalRelation } from "./orders/order-items.js";
export {
  assertOpaqueExternalReference,
  buildOpaqueExternalReference,
} from "./orders/external-reference.js";
export { normalizePayerEmail } from "./orders/payer.js";
export {
  sanitizeStatementDescriptor,
  resolveStatementDescriptor,
} from "./orders/statement-descriptor.js";
export {
  buildMercadoPagoSplitOrderRequest,
  buildSplitEntriesFromDistribution,
  inferAmountType,
  resolveMpAmountType,
  mapMercadoPagoOrderStatus,
  mapMercadoPagoOrderResponse,
  stablePayloadHash,
} from "./orders/mapper.js";
export { parseMercadoPagoOrdersWebhook } from "./webhooks/parser.js";
export {
  parseMercadoPagoOrdersNotification,
  isMercadoPagoOrdersWebhookType,
  buildOrdersWebhookEventId,
} from "./webhooks/orders-notification.js";
export {
  signMercadoPagoTestWebhook,
  buildOrdersWebhookFixtureBody,
} from "./webhooks/sign-test-fixture.js";
export {
  verifyMercadoPagoWebhookSignature,
  parseMercadoPagoSignatureHeader,
  buildMercadoPagoWebhookManifest,
  normalizeMercadoPagoDataId,
} from "./webhooks/signature.js";
export type {
  VerifyMercadoPagoWebhookSignatureInput,
  VerifyMercadoPagoWebhookSignatureResult,
} from "./webhooks/signature.js";
export {
  parseMercadoPagoPaymentNotification,
  extractMercadoPagoDataId,
} from "./webhooks/payment-notification.js";
export type {
  MercadoPagoPaymentNotification,
  ParseMercadoPagoPaymentNotificationResult,
} from "./webhooks/payment-notification.js";
export { FakeMercadoPagoHttpClient } from "./testing/fake-client.js";
export * from "./testing/fixtures.js";
export * from "./checkout-pro/index.js";
export {
  createMercadoPagoOrderRefund,
  createMercadoPagoRefund,
  getMercadoPagoRefund,
  MercadoPagoRefundError,
  mapMercadoPagoRefundHttpError,
} from "./refunds/index.js";
export type {
  CreateMercadoPagoOrderRefundInput,
  CreateMercadoPagoOrderRefundResult,
  MpOrderRefundResponse,
  MpOrderRefundRequestBody,
} from "./refunds/index.js";
