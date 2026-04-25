import { createHmac, timingSafeEqual } from "node:crypto";

const MP_API_BASE = "https://api.mercadopago.com";

function getAccessToken() {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("MP_ACCESS_TOKEN no está configurado.");
  }
  return token;
}

type CreatePreferenceInput = {
  title: string;
  amountArs: number;
  externalReference: string;
  payerEmail: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl?: string;
  metadata?: Record<string, string>;
};

export async function createMercadoPagoPreference(input: CreatePreferenceInput) {
  const token = getAccessToken();
  const body = {
    items: [
      {
        title: input.title,
        quantity: 1,
        currency_id: "ARS",
        unit_price: Number(input.amountArs.toFixed(2)),
      },
    ],
    payer: {
      email: input.payerEmail,
    },
    external_reference: input.externalReference,
    metadata: input.metadata,
    back_urls: {
      success: input.successUrl,
      failure: input.failureUrl,
      pending: input.pendingUrl,
    },
    auto_return: "approved",
    notification_url: input.notificationUrl,
  };
  const response = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mercado Pago preference error (${response.status}): ${text}`);
  }
  const json = (await response.json()) as { id: string; init_point?: string; sandbox_init_point?: string };
  return {
    preferenceId: json.id,
    initPoint: json.init_point ?? null,
    sandboxInitPoint: json.sandbox_init_point ?? null,
    checkoutUrl: json.init_point ?? json.sandbox_init_point ?? null,
  };
}

export async function getMercadoPagoPayment(paymentId: string) {
  const token = getAccessToken();
  const response = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mercado Pago payment error (${response.status}): ${text}`);
  }
  return (await response.json()) as {
    id: number;
    status: string;
    status_detail?: string | null;
    external_reference?: string | null;
    transaction_amount?: number | null;
    payment_method_id?: string | null;
    metadata?: Record<string, unknown> | null;
  };
}

function parseSignatureHeader(signatureHeader: string) {
  const parts = signatureHeader
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  let ts: string | null = null;
  let v1: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key === "ts") ts = value ?? null;
    if (key === "v1") v1 = value ?? null;
  }

  return { ts, v1 };
}

export function verifyMercadoPagoWebhookSignature(input: {
  signatureHeader: string | null;
  requestIdHeader: string | null;
  dataId: string | null;
  secret: string | null;
}) {
  if (!input.secret) {
    return {
      ok: false as const,
      reason: "missing_secret" as const,
    };
  }
  if (!input.signatureHeader || !input.requestIdHeader || !input.dataId) {
    return {
      ok: false as const,
      reason: "missing_required_values" as const,
    };
  }

  const { ts, v1 } = parseSignatureHeader(input.signatureHeader);
  if (!ts || !v1) {
    return {
      ok: false as const,
      reason: "invalid_signature_header" as const,
    };
  }

  // Formato de manifest según documentación oficial de MP para webhooks.
  const manifest = `id:${input.dataId};request-id:${input.requestIdHeader};ts:${ts};`;
  const digest = createHmac("sha256", input.secret).update(manifest).digest("hex");
  const expected = Buffer.from(digest, "utf8");
  const provided = Buffer.from(v1, "utf8");
  const sameLength = expected.length === provided.length;
  const valid = sameLength && timingSafeEqual(expected, provided);

  if (!valid) {
    return {
      ok: false as const,
      reason: "signature_mismatch" as const,
    };
  }

  return { ok: true as const };
}
