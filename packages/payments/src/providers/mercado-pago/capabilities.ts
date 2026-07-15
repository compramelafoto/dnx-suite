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
