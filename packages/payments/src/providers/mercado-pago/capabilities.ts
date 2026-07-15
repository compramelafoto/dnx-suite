import type { ProviderCapabilities } from "../types.js";

/**
 * Placeholder for the future Mercado Pago Orders API Split 1:N adapter.
 * No HTTP / SDK calls in Etapa 02.
 */
export const MERCADOPAGO_ORDERS_CAPABILITIES: ProviderCapabilities = {
  supportsSplit1N: true,
  supportsMarketplaceFee: false,
  supportsRefundPerRecipient: true,
  supportsDeviceId: true,
  supportsSplitConsent: true,
  supportedCurrencies: ["ARS", "BRL", "USD", "MXN", "CLP", "UYU"],
};

export type MercadoPagoOrdersAdapter = never;
