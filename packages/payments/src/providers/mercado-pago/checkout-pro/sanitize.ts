/**
 * Sanitiza respuestas Preference/Payment: nunca access token ni PII completa.
 */
export function sanitizeMercadoPagoPreferenceResponse(
  body: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: body.id ?? null,
    init_point: typeof body.init_point === "string" ? body.init_point : null,
    sandbox_init_point:
      typeof body.sandbox_init_point === "string" ? body.sandbox_init_point : null,
    external_reference:
      typeof body.external_reference === "string" ? body.external_reference : null,
    notification_url:
      typeof body.notification_url === "string" ? "[present]" : null,
    items_count: Array.isArray(body.items) ? body.items.length : 0,
    // intentionally omit payer, metadata with emails, tokens
  };
}

export function sanitizeMercadoPagoPaymentResponse(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const transactionAmount = body.transaction_amount;
  return {
    id: body.id ?? null,
    status: body.status ?? null,
    status_detail: body.status_detail ?? null,
    external_reference:
      typeof body.external_reference === "string" ? body.external_reference : null,
    currency_id: body.currency_id ?? null,
    transaction_amount:
      typeof transactionAmount === "number" ? transactionAmount : null,
    live_mode: body.live_mode === true,
    // Cuándo se aprobó (la fecha de la venta en FOTOFFICE). No es un dato personal.
    date_approved: typeof body.date_approved === "string" ? body.date_approved : null,
    // Comisiones que MP descontó (tipo y monto en pesos): sirven para el neto de un cobro. No son datos personales.
    fee_details: sanitizeFeeDetails(body.fee_details),
    // omit payer, card, token, phone, email
  };
}

function sanitizeFeeDetails(raw: unknown): Array<{ type: string; amount: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ type: string; amount: number }> = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const { type, amount } = row as { type?: unknown; amount?: unknown };
    if (typeof type === "string" && typeof amount === "number" && Number.isFinite(amount)) {
      out.push({ type: type.slice(0, 64), amount });
    }
  }
  return out;
}

export function assertNoSecretLeak(payload: unknown, token: string): void {
  const text = JSON.stringify(payload);
  if (token && text.includes(token)) {
    throw new Error("secret_leak_detected");
  }
  if (/Bearer\s+[A-Za-z0-9._-]+/i.test(text)) {
    throw new Error("bearer_leak_detected");
  }
}
