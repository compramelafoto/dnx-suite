/**
 * Canonical frontend → backend card payment submission (Orders / Brick).
 * Never include PAN, CVV, or raw expiration.
 */

export type CardPaymentPayerIdentification = {
  type: string;
  number: string;
};

export type CardPaymentPayer = {
  /** Optional from Brick; server must set real buyer email. */
  email?: string;
  identification?: CardPaymentPayerIdentification;
};

/**
 * Payload accepted by DNX consumers after Card Payment Brick onSubmit.
 * Field names follow Brick formData (snake_case from MP) mapped to camelCase.
 */
export type CardPaymentSubmission = {
  /** One-time card token from MercadoPago.js / Brick — never log. */
  token: string;
  paymentMethodId: string;
  paymentTypeId?: string;
  issuerId?: string;
  installments: number;
  payer: CardPaymentPayer;
  /**
   * Official MP device session (`window.MP_DEVICE_SESSION_ID`).
   * Sent server-side as x-meli-session-id. Never invent.
   */
  deviceSessionId: string;
};

/**
 * Raw shape commonly returned by Card Payment Brick onSubmit (formData).
 * @see https://www.mercadopago.com.ar/developers/en/docs/checkout-bricks/card-payment-brick/default-rendering
 */
export type MercadoPagoCardPaymentBrickFormData = {
  token: string;
  payment_method_id: string;
  payment_type_id?: string;
  issuer_id?: string | number;
  installments?: number;
  transaction_amount?: number;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
};

export type CardBrickUiState =
  | "INITIAL"
  | "READY"
  | "SUBMITTING"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED"
  | "ERROR";

export type CardPaymentServerResult = {
  uiState: Extract<CardBrickUiState, "APPROVED" | "PROCESSING" | "REJECTED" | "ERROR">;
  paymentOrderId?: string;
  providerOrderId?: string;
  statusDetail?: string;
  userMessage: string;
  /** Redirect hint (pending/success/error pages). */
  redirectPath?: string;
};
