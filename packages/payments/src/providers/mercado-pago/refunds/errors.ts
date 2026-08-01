import { PaymentProviderError } from "../../../errors/provider-errors.js";

export class MercadoPagoRefundError extends PaymentProviderError {
  constructor(opts: {
    code: string;
    message: string;
    statusCode?: number;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(opts);
    this.name = "MercadoPagoRefundError";
  }
}

export function mapMercadoPagoRefundHttpError(input: {
  statusCode: number;
  title?: string | null;
  detail?: string | null;
}): MercadoPagoRefundError {
  const code = (input.title ?? "refund_error").trim() || "refund_error";
  const message = (input.detail ?? input.title ?? "Mercado Pago refund failed").slice(0, 200);
  const retryable =
    input.statusCode === 422 ||
    input.statusCode === 423 ||
    input.statusCode === 429 ||
    input.statusCode >= 500;

  if (code === "order_already_refunded" || code === "idempotency_key_already_used") {
    return new MercadoPagoRefundError({
      code: code.toUpperCase(),
      message,
      statusCode: input.statusCode,
      retryable: false,
    });
  }
  if (code === "refund_amount_exceeds" || code === "cannot_refund_order") {
    return new MercadoPagoRefundError({
      code: code.toUpperCase(),
      message,
      statusCode: input.statusCode,
      retryable: false,
    });
  }
  if (code === "order_refund_already_in_process" || input.statusCode === 423) {
    return new MercadoPagoRefundError({
      code: "REFUND_IN_PROCESS",
      message,
      statusCode: input.statusCode,
      retryable: true,
    });
  }
  return new MercadoPagoRefundError({
    code: code.toUpperCase(),
    message,
    statusCode: input.statusCode,
    retryable,
  });
}
