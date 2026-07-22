import type { ProviderCapabilities } from "../types.js";

/**
 * Mercado Pago Orders API Split 1:N adapter capabilities.
 */
export const MERCADOPAGO_ORDERS_CAPABILITIES: ProviderCapabilities = {
  supportsSplit1N: true,
  supportsMarketplaceFee: false,
  supportsRefundPerRecipient: true,
  supportsDeviceId: true,
  supportsSplitConsent: true,
  supportedCurrencies: ["ARS", "BRL", "USD", "MXN", "CLP", "UYU"],
};

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
export { validateSplitOrderForMercadoPago } from "./orders/validator.js";
export {
  buildMercadoPagoSplitOrderRequest,
  mapMercadoPagoOrderStatus,
  mapMercadoPagoOrderResponse,
  stablePayloadHash,
} from "./orders/mapper.js";
export { parseMercadoPagoOrdersWebhook } from "./webhooks/parser.js";
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
