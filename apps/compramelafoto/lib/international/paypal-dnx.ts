/**
 * PayPal de DNX: cobro de las recargas de saldo del piloto internacional (Orders v2, CAPTURE).
 * Credenciales: PAYPAL_DNX_CLIENT_ID, PAYPAL_DNX_CLIENT_SECRET, PAYPAL_DNX_ENV (sandbox | live).
 */
type Env = Record<string, string | undefined>;
const TIMEOUT_MS = 15_000;

export function paypalBaseUrl(envName: string | undefined): string {
  return envName === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function isPaypalDnxConfigured(env: Env = process.env): boolean {
  return Boolean(env.PAYPAL_DNX_CLIENT_ID?.trim() && env.PAYPAL_DNX_CLIENT_SECRET?.trim());
}

export function usdCentsToPaypalValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

function paypalValueToUsdCents(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export async function getPaypalToken(fetchImpl: typeof fetch = fetch, env: Env = process.env): Promise<string> {
  const basic = Buffer.from(`${env.PAYPAL_DNX_CLIENT_ID ?? ""}:${env.PAYPAL_DNX_CLIENT_SECRET ?? ""}`).toString("base64");
  const res = await fetchImpl(`${paypalBaseUrl(env.PAYPAL_DNX_ENV)}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!res.ok || !json.access_token) throw new Error(`paypal_token_failed:${res.status}`);
  return json.access_token;
}

export async function createTopUpOrder(
  params: { amountUsdCents: number; userId: number; chosenUsdCents: number; returnUrl: string; cancelUrl: string },
  fetchImpl: typeof fetch = fetch,
  env: Env = process.env,
): Promise<{ paypalOrderId: string; approveUrl: string }> {
  const token = await getPaypalToken(fetchImpl, env);
  const res = await fetchImpl(`${paypalBaseUrl(env.PAYPAL_DNX_ENV)}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: "Recarga de saldo CompraMeLaFoto",
          custom_id: `${params.userId}:${params.chosenUsdCents}`,
          amount: { currency_code: "USD", value: usdCentsToPaypalValue(params.amountUsdCents) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "CompraMeLaFoto",
            locale: "es-AR",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: params.returnUrl,
            cancel_url: params.cancelUrl,
          },
        },
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; links?: Array<{ rel?: string; href?: string }> };
  const approve = json.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (!res.ok || !json.id || !approve) throw new Error(`paypal_create_failed:${res.status}`);
  return { paypalOrderId: json.id, approveUrl: approve };
}

type CaptureResult = {
  status: "COMPLETED" | "ALREADY_CAPTURED" | "FAILED";
  captureId: string | null;
  paidUsdCents: number;
  customId: string | null;
};

function readCapture(json: unknown): { captureId: string | null; paidUsdCents: number; customId: string | null } {
  const unit = (json as { purchase_units?: Array<Record<string, unknown>> })?.purchase_units?.[0];
  const capture = (unit?.payments as { captures?: Array<Record<string, unknown>> } | undefined)?.captures?.find(
    (c) => c.status === "COMPLETED",
  );
  const amount = capture?.amount as { currency_code?: string; value?: string } | undefined;
  return {
    captureId: typeof capture?.id === "string" ? capture.id : null,
    paidUsdCents: amount?.currency_code === "USD" ? paypalValueToUsdCents(amount.value) : 0,
    customId: typeof unit?.custom_id === "string" ? unit.custom_id : null,
  };
}

/** Captura la orden. Si ya estaba capturada, devuelve la captura existente sin cobrar de nuevo. */
export async function captureTopUpOrder(
  paypalOrderId: string,
  fetchImpl: typeof fetch = fetch,
  env: Env = process.env,
): Promise<CaptureResult> {
  const token = await getPaypalToken(fetchImpl, env);
  const base = paypalBaseUrl(env.PAYPAL_DNX_ENV);
  const id = encodeURIComponent(paypalOrderId);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const res = await fetchImpl(`${base}/v2/checkout/orders/${id}/capture`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok) {
    const c = readCapture(json);
    return c.captureId ? { status: "COMPLETED", ...c } : { status: "FAILED", captureId: null, paidUsdCents: 0, customId: c.customId };
  }
  const issue = (json as { details?: Array<{ issue?: string }> })?.details?.[0]?.issue;
  if (res.status === 422 && issue === "ORDER_ALREADY_CAPTURED") {
    const again = await fetchImpl(`${base}/v2/checkout/orders/${id}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const c = readCapture(await again.json().catch(() => ({})));
    if (c.captureId) return { status: "ALREADY_CAPTURED", ...c };
  }
  return { status: "FAILED", captureId: null, paidUsdCents: 0, customId: null };
}

export function parseCustomId(customId: string | null): { userId: number; chosenUsdCents: number } | null {
  const m = /^(\d+):(\d+)$/.exec(customId ?? "");
  if (!m) return null;
  return { userId: Number(m[1]), chosenUsdCents: Number(m[2]) };
}
