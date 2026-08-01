import type { ProviderCapabilities } from "../types.js";

/**
 * Mercado Pago Orders API Split 1:N adapter capabilities.
 */
export const MERCADOPAGO_ORDERS_CAPABILITIES: ProviderCapabilities = {
  supportsSplit1N: true,
  supportsMarketplaceFee: false,
  /**
   * Orders refund API refunds at order/transaction level — not per partner receiver.
   * Internal DNX allocations reverse proportionally; do not claim MP per-recipient refund.
   */
  supportsRefundPerRecipient: false,
  supportsDeviceId: true,
  supportsSplitConsent: true,
  supportedCurrencies: ["ARS", "BRL", "USD", "MXN", "CLP", "UYU"],
};
