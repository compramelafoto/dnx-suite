/**
 * Map Mercado Pago status_detail → user-facing Spanish messages.
 * Keep technical codes for telemetry only.
 */

const MESSAGES: Record<string, string> = {
  accredited: "Tu pago fue acreditado correctamente.",
  pending_contingency: "Estamos procesando tu pago. Te avisaremos cuando se confirme.",
  pending_review_manual: "Tu pago está en revisión. Te avisaremos el resultado.",
  cc_rejected_insufficient_amount: "No hay fondos suficientes en la tarjeta.",
  insufficient_amount: "No hay fondos suficientes en la tarjeta.",
  cc_rejected_bad_filled_card_number: "Revisá el número de la tarjeta.",
  cc_rejected_bad_filled_date: "Revisá la fecha de vencimiento de la tarjeta.",
  cc_rejected_bad_filled_security_code: "Revisá el código de seguridad de la tarjeta.",
  cc_rejected_bad_filled_other: "Revisá los datos de la tarjeta.",
  bad_filled_card_data: "Revisá los datos de la tarjeta.",
  cc_rejected_high_risk: "El pago fue rechazado por validación de seguridad.",
  high_risk: "El pago fue rechazado por validación de seguridad.",
  cc_rejected_blacklist: "El pago no pudo procesarse con esta tarjeta.",
  cc_rejected_call_for_authorize: "Tu banco requiere autorización. Contactalos e intentá de nuevo.",
  cc_rejected_card_disabled: "La tarjeta está deshabilitada. Contactá a tu banco.",
  cc_rejected_duplicated_payment: "Ya existe un pago similar. No vuelvas a intentar todavía.",
  cc_rejected_max_attempts: "Alcanzaste el máximo de intentos. Probá más tarde.",
  cc_rejected_other_reason: "El pago fue rechazado. Probá con otra tarjeta o medio.",
  rejected_by_bank: "El banco rechazó el pago. Probá con otro medio.",
  rejected_by_regulations: "El pago no pudo autorizarse por regulaciones.",
};

export function mapMercadoPagoStatusDetailToUserMessage(
  statusDetail: string | null | undefined,
  opts?: { fallback?: string },
): string {
  const key = (statusDetail ?? "").trim().toLowerCase();
  if (!key) {
    return opts?.fallback ?? "No pudimos completar el pago. Intentá de nuevo.";
  }
  return (
    MESSAGES[key] ??
    opts?.fallback ??
    "El pago no pudo completarse. Revisá los datos o probá con otra tarjeta."
  );
}

export function mapProviderOrderStatusToCardUiState(
  status: string | null | undefined,
): "APPROVED" | "PROCESSING" | "REJECTED" | "ERROR" {
  const s = (status ?? "").toUpperCase();
  if (
    s === "APPROVED" ||
    s === "PROCESSED_ACCREDITED" ||
    s === "PROCESSED" ||
    s === "ACCREDITED"
  ) {
    return "APPROVED";
  }
  if (s === "FAILED" || s === "REJECTED" || s === "CANCELED" || s === "CANCELLED") {
    return "REJECTED";
  }
  if (s === "PROCESSING" || s === "PENDING" || s === "OPEN" || s === "CREATED") {
    return "PROCESSING";
  }
  return "ERROR";
}
