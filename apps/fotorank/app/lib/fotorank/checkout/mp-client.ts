/**
 * Cliente mínimo de Mercado Pago para Checkout Pro (preferences y consulta de pago).
 *
 * Deliberadamente pequeño: sólo las dos llamadas que este flujo necesita.
 * No se reutiliza `MercadoPagoHttpClient` de `@repo/payments` porque ese cliente
 * está construido alrededor de Orders API Split 1:N, que acá no interviene.
 *
 * Nunca registra el access token, ni el body completo de una respuesta de pago.
 */

import type { PreferenceBody } from "./preference";

const MP_API_BASE = "https://api.mercadopago.com";
const REQUEST_TIMEOUT_MS = 15_000;

export class MercadoPagoClientError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "MercadoPagoClientError";
    this.code = code;
    this.status = status;
  }
}

async function request<T>(input: {
  path: string;
  method: "GET" | "POST";
  accessToken: string;
  body?: unknown;
  /** Evita duplicar una preference si el participante reintenta. */
  idempotencyKey?: string;
}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${MP_API_BASE}${input.path}`, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "X-Idempotency-Key": input.idempotencyKey } : {}),
      },
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      // Se lee el cuerpo para diagnosticar, pero no se propaga entero: puede
      // contener datos del pagador.
      let detail = "";
      try {
        const text = await res.text();
        detail = text.slice(0, 300);
      } catch {
        detail = "(sin cuerpo)";
      }
      throw new MercadoPagoClientError(
        "MP_REQUEST_FAILED",
        `Mercado Pago respondió ${res.status}: ${detail}`,
        res.status,
      );
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof MercadoPagoClientError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MercadoPagoClientError("MP_TIMEOUT", "Mercado Pago no respondió a tiempo.", 504);
    }
    throw new MercadoPagoClientError(
      "MP_NETWORK_ERROR",
      "No se pudo contactar a Mercado Pago.",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export type CreatedPreference = {
  id: string;
  /** URL de checkout productiva. */
  initPoint: string;
  /** URL de checkout de prueba. */
  sandboxInitPoint: string | null;
};

export async function createPreference(input: {
  accessToken: string;
  body: PreferenceBody;
  idempotencyKey: string;
}): Promise<CreatedPreference> {
  const res = await request<{
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
  }>({
    path: "/checkout/preferences",
    method: "POST",
    accessToken: input.accessToken,
    body: input.body,
    idempotencyKey: input.idempotencyKey,
  });

  if (!res.id || !res.init_point) {
    throw new MercadoPagoClientError(
      "MP_INVALID_PREFERENCE_RESPONSE",
      "Mercado Pago no devolvió una preferencia válida.",
      502,
    );
  }

  return {
    id: res.id,
    initPoint: res.init_point,
    sandboxInitPoint: res.sandbox_init_point ?? null,
  };
}

export type ProviderPayment = {
  id: string;
  status: string;
  statusDetail: string | null;
  /** Importe efectivamente pagado, en pesos. */
  transactionAmount: number | null;
  externalReference: string | null;
  liveMode: boolean | null;
};

/**
 * Consulta el pago server-to-server.
 *
 * El webhook sólo informa un id: el estado SIEMPRE se verifica contra la API,
 * nunca se confía en el cuerpo de la notificación.
 */
export async function getPayment(input: {
  accessToken: string;
  paymentId: string;
}): Promise<ProviderPayment> {
  const res = await request<{
    id?: number | string;
    status?: string;
    status_detail?: string;
    transaction_amount?: number;
    external_reference?: string;
    live_mode?: boolean;
  }>({
    path: `/v1/payments/${encodeURIComponent(input.paymentId)}`,
    method: "GET",
    accessToken: input.accessToken,
  });

  if (!res.id || !res.status) {
    throw new MercadoPagoClientError(
      "MP_INVALID_PAYMENT_RESPONSE",
      "Mercado Pago no devolvió un pago válido.",
      502,
    );
  }

  return {
    id: String(res.id),
    status: res.status,
    statusDetail: res.status_detail ?? null,
    transactionAmount:
      typeof res.transaction_amount === "number" ? res.transaction_amount : null,
    externalReference: res.external_reference ?? null,
    liveMode: typeof res.live_mode === "boolean" ? res.live_mode : null,
  };
}

/** URL a la que redirigir según el entorno. */
export function resolveCheckoutUrl(
  preference: CreatedPreference,
  environment: "sandbox" | "production",
): string {
  if (environment === "production") return preference.initPoint;
  return preference.sandboxInitPoint ?? preference.initPoint;
}
