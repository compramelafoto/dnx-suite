import type {
  CardPaymentSubmission,
  MercadoPagoCardPaymentBrickFormData,
} from "./card-payment-types.js";

export class CardPaymentSubmissionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CardPaymentSubmissionError";
    this.code = code;
  }
}

/**
 * Map Brick onSubmit formData + official device session → CardPaymentSubmission.
 * Ignores `transaction_amount` from the browser (server reconstructs price).
 */
export function mapBrickFormDataToCardPaymentSubmission(
  formData: MercadoPagoCardPaymentBrickFormData,
  deviceSessionId: string,
): CardPaymentSubmission {
  const token = formData.token?.trim();
  if (!token) {
    throw new CardPaymentSubmissionError("CARD_TOKEN_REQUIRED", "Missing card token");
  }

  const paymentMethodId = formData.payment_method_id?.trim();
  if (!paymentMethodId) {
    throw new CardPaymentSubmissionError(
      "PAYMENT_METHOD_REQUIRED",
      "Missing payment_method_id",
    );
  }

  const email = formData.payer?.email?.trim();
  const session = deviceSessionId.trim();
  if (!session) {
    throw new CardPaymentSubmissionError(
      "DEVICE_SESSION_REQUIRED",
      "Missing deviceSessionId from MP_DEVICE_SESSION_ID",
    );
  }

  const installments =
    typeof formData.installments === "number" && formData.installments > 0
      ? Math.floor(formData.installments)
      : 1;

  const issuerRaw = formData.issuer_id;
  const issuerId =
    issuerRaw === undefined || issuerRaw === null || issuerRaw === ""
      ? undefined
      : String(issuerRaw);

  const identification =
    formData.payer?.identification?.type && formData.payer.identification.number
      ? {
          type: String(formData.payer.identification.type),
          number: String(formData.payer.identification.number),
        }
      : undefined;

  return {
    token,
    paymentMethodId,
    ...(formData.payment_type_id?.trim()
      ? { paymentTypeId: formData.payment_type_id.trim() }
      : {}),
    ...(issuerId ? { issuerId } : {}),
    installments,
    payer: {
      ...(email ? { email } : {}),
      ...(identification ? { identification } : {}),
    },
    deviceSessionId: session,
  };
}

/** Strip secrets for safe logging / audit metadata. */
export function sanitizeCardPaymentSubmissionForLog(
  submission: CardPaymentSubmission,
): Record<string, unknown> {
  return {
    paymentMethodId: submission.paymentMethodId,
    paymentTypeId: submission.paymentTypeId ?? null,
    issuerId: submission.issuerId ?? null,
    installments: submission.installments,
    payerEmailDomain: submission.payer.email?.includes("@")
      ? submission.payer.email.split("@")[1]
      : null,
    hasIdentification: Boolean(submission.payer.identification),
    // Imp 06 — device evidence without persisting full session id
    DEVICE_SESSION_PRESENT: Boolean(submission.deviceSessionId?.trim()),
    deviceSessionIdLength: submission.deviceSessionId.trim().length,
    deviceSessionIdPrefix: submission.deviceSessionId.slice(0, 4) + "…",
    tokenPresent: Boolean(submission.token),
    // Never include token value
  };
}
