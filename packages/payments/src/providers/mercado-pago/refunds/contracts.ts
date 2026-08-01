/**
 * Mercado Pago Orders API — Refund order
 * POST /v1/orders/{order_id}/refund
 *
 * Total refund: empty body (no transactions).
 * Partial refund: transactions[{ id, amount }].
 *
 * @see https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-api/refund-order/post
 */

export type MpOrderRefundTransactionInput = {
  /** Payment transaction id from the order (PAY…). */
  id: string;
  /** Decimal amount string, e.g. "24.50" — never float in our layer. */
  amount: string;
};

export type MpOrderRefundRequestBody = {
  transactions?: MpOrderRefundTransactionInput[];
};

export type MpOrderRefundEntry = {
  id: string;
  transaction_id?: string;
  reference_id?: string;
  amount?: string;
  status?: string;
};

export type MpOrderRefundResponse = {
  id: string;
  status: string;
  status_detail?: string;
  transactions?: {
    payments?: Array<{
      id: string;
      status?: string;
      amount?: string;
      paid_amount?: string;
      refunded_amount?: string;
    }>;
    refunds?: MpOrderRefundEntry[];
  };
};

/** @deprecated Prefer MpOrderRefundRequestBody — kept for type compatibility. */
export interface MpRefundRequest {
  order_id: string;
  amount?: string;
  /** Not supported by Orders refund API — ignored if present. */
  receiver_id?: string;
  transaction_id?: string;
}

/** @deprecated Prefer MpOrderRefundResponse. */
export interface MpRefundResponse {
  id: string;
  status: string;
  amount?: string;
  status_detail?: string;
  provider_refund_ids?: string[];
}
