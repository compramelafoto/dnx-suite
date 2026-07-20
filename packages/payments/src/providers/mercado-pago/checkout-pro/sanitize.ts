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
    // omit payer, card, token, phone, email
  };
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
