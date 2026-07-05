/**
 * Literales del contrato JSON §1.8.1 y alineación con enums Prisma (mismo spelling).
 * docs/PREVENTA-CANJEABLE-SPEC-TECNICA.md v1.3
 */

export const CHECKOUT_PAYMENT_SOURCE_JSON = {
  MERCADO_PAGO: "MERCADO_PAGO",
  PREPAID_PACK: "PREPAID_PACK",
} as const;

export type CheckoutPaymentSourceJson =
  (typeof CHECKOUT_PAYMENT_SOURCE_JSON)[keyof typeof CHECKOUT_PAYMENT_SOURCE_JSON];

export const ORDER_ORIGIN_JSON = {
  STANDARD_CHECKOUT: "STANDARD_CHECKOUT",
  PREVENTA_PACK: "PREVENTA_PACK",
  PACK_REDEMPTION: "PACK_REDEMPTION",
} as const;

export type OrderOriginJson = (typeof ORDER_ORIGIN_JSON)[keyof typeof ORDER_ORIGIN_JSON];

export const ORDER_ITEM_LINE_ORIGIN_JSON = {
  STANDARD: "STANDARD",
  PACK_INCLUDED: "PACK_INCLUDED",
  EXTRA: "EXTRA",
} as const;

export type OrderItemLineOriginJson =
  (typeof ORDER_ITEM_LINE_ORIGIN_JSON)[keyof typeof ORDER_ITEM_LINE_ORIGIN_JSON];
