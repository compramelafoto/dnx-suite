/**
 * Mercado Pago Orders API — Refund order
 * POST /v1/orders/{order_id}/refund
 *
 * En órdenes con split el reembolso se dirige **al participante**, no a la
 * transacción de pago. MP lo confirmó el 13/10/2026 (IXFS-16376) después de que
 * todos nuestros intentos con `transactions` dieran `split_validation_error`:
 *
 *     total de la orden     → body vacío
 *     total a 1 participante → { splits: [{ receiver_id }] }
 *     parcial a 1           → { splits: [{ receiver_id, amount }] }
 *     combinado             → varias entradas, con o sin amount cada una
 *
 * Siempre `splits`, nunca `transactions`, y nunca mezclados. Montos, no
 * porcentajes. Un `receiver_id` sin `amount` reembolsa la pata completa de ese
 * participante.
 *
 * @see https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-api/refund-order/post
 */

export type MpOrderRefundSplitInput = {
  /** Receptor al que se le reembolsa: owner user id o partner receiver id. */
  receiver_id: string;
  /** Monto decimal, p. ej. "24.50". Omitido = su pata completa. */
  amount?: string;
};

export type MpOrderRefundRequestBody = {
  splits?: MpOrderRefundSplitInput[];
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
