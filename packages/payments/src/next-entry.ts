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
  createMercadoPagoTestClickatonProviderBridge,
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
export type { CheckoutEventOrigin } from "./application/services/clickaton-checkout/types";
export { MercadoPagoHttpClient } from "./providers/mercado-pago/client/mercado-pago-http-client";
export { createMercadoPagoProviderConfig } from "./providers/mercado-pago/client/mercado-pago-environment";
