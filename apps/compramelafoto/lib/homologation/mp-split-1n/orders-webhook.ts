/**
 * Receptor del webhook `order` de Mercado Pago para la homologación de
 * Orders API + Split (1 a N) de Comprame la Foto.
 *
 * Confirmado por Mercado Pago: el tópico para Orders API es `order` (no
 * `payment`), y el webhook **no es fuente de verdad**. La secuencia obligatoria
 * es webhook → `data.id` → `GET /v1/orders/{data.id}` → reconciliar → recién
 * entonces cualquier efecto.
 *
 * Esta superficie NO produce ningún efecto de negocio: observa y reconcilia.
 * No acredita, no libera producto, no toca el Checkout Pro productivo de CLF
 * ni su `marketplace_fee`.
 *
 * IDENTIDAD: el GET Order usa las credenciales TEST de la MISMA aplicación de
 * Mercado Pago que creó la Order desde el Card Brick. Un GET con el token de
 * otra cuenta devuelve `Order not found`.
 */
import {
  createPrismaDnxPaymentsPersistence,
  isOrders1nWebhookObserveEnabled,
  isSandboxAccessToken,
  mapMercadoPagoOrderResponse,
  observeOrdersWebhook,
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  type DnxPaymentsPrismaDelegates,
  type FetchCanonicalOrder,
} from "@repo/payments/next";
import { prisma } from "@repo/db";

export type ClfOrdersWebhookDenial =
  | "OBSERVE_FLAG_OFF"
  | "PRODUCTION_ORDERS_FLAG_ON"
  | "SANDBOX_CREDENTIALS_MISSING";

function readEnv(name: string): string | undefined {
  return (process.env as Record<string, string | undefined>)[name]?.trim() || undefined;
}

function isTruthy(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Guard del receptor. Independiente del guard de creación de Orders: este
 * endpoint no escribe en Mercado Pago, sólo lee y reconcilia.
 */
export function assertClfOrdersWebhookAllowed():
  | { ok: true }
  | { ok: false; code: ClfOrdersWebhookDenial } {
  if (isTruthy(readEnv("DNX_MP_ORDERS_1N_PRODUCTION_ENABLED"))) {
    return { ok: false, code: "PRODUCTION_ORDERS_FLAG_ON" };
  }
  if (!isOrders1nWebhookObserveEnabled()) {
    return { ok: false, code: "OBSERVE_FLAG_OFF" };
  }
  return { ok: true };
}

function parseAmountToMinor(amount: string | undefined): string | null {
  if (!amount) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return String(Math.round(n * 100));
}

/**
 * GET /v1/orders/{id} con las credenciales TEST de la app de homologación.
 * Devuelve null si no hay credenciales sandbox: el pipeline entonces marca
 * `GET_ORDER_NOT_CONFIGURED` en vez de simular un procesamiento limpio.
 */
export function buildClfFetchCanonicalOrder(): FetchCanonicalOrder | null {
  const token = readEnv("MERCADOPAGO_TEST_ACCESS_TOKEN");
  if (!token || !isSandboxAccessToken(token)) return null;

  const config = createMercadoPagoProviderConfig({
    environment: "sandbox",
    accessToken: token,
    ...(readEnv("MERCADOPAGO_TEST_PUBLIC_KEY")
      ? { publicKey: readEnv("MERCADOPAGO_TEST_PUBLIC_KEY") }
      : {}),
  });
  const http = new MercadoPagoHttpClient(config);

  return async (providerOrderId) => {
    const raw = await http.request<{
      id: string;
      status: string;
      status_detail?: string;
      external_reference?: string;
      total_amount?: string;
      currency?: string;
      splits?: Array<{ amount?: string }>;
      transactions?: { payments?: unknown[] };
    }>({ method: "GET", path: `/v1/orders/${providerOrderId}` });
    const body = raw.body;
    if (!body?.id) return null;
    const mapped = mapMercadoPagoOrderResponse(body as never);
    return {
      providerOrderId: mapped.providerOrderId,
      status: mapped.status,
      statusDetail: mapped.statusDetail ?? null,
      externalReference: body.external_reference ?? null,
      totalMinor: parseAmountToMinor(body.total_amount),
      currency: body.currency ?? "ARS",
      splitAmounts: (body.splits ?? []).map((s) => String(s.amount ?? "0")),
      paymentCount: body.transactions?.payments?.length ?? mapped.payments.length,
    };
  };
}

export type ClfOrdersWebhookOutcome =
  | { ok: false; code: string; status: number }
  | {
      ok: true;
      status: 200;
      evidence: {
        WEBHOOK_RECEIVED: true;
        SIGNATURE_VALID: true;
        DATA_ID_PRESENT: boolean;
        GET_ORDER_CALLED: boolean;
        GET_ORDER_FOUND: boolean;
        GET_ORDER_ID_MATCHES_WEBHOOK: boolean;
        RECONCILIATION: "PASS" | "MISMATCH" | "NOT_RUN";
        BUSINESS_DECISION_SOURCE: "GET_ORDER";
        BUSINESS_EFFECT: "NONE_OBSERVE_ONLY";
        outcome: "processed" | "duplicate";
        providerOrderIdPrefix: string;
        orderStatus: string | null;
        orderStatusDetail: string | null;
        recipientCount: number | null;
        liveMode: boolean;
        alerts: string[];
        deliveryClass: string;
      };
    };

export async function handleClfOrdersWebhook(input: {
  headers: Record<string, string | undefined>;
  rawBody: string;
  queryDataId?: string | null;
  queryType?: string | null;
}): Promise<ClfOrdersWebhookOutcome> {
  const guard = assertClfOrdersWebhookAllowed();
  if (!guard.ok) {
    // 200: Mercado Pago no debe reintentar algo que decidimos ignorar.
    return { ok: false, code: guard.code, status: 200 };
  }

  const fetchCanonicalOrder = buildClfFetchCanonicalOrder();

  const observed = await observeOrdersWebhook({
    headers: input.headers,
    rawBody: input.rawBody,
    queryDataId: input.queryDataId ?? null,
    queryType: input.queryType ?? null,
    webhookSecret: readEnv("MERCADOPAGO_WEBHOOK_SECRET") ?? null,
    persistence: createPrismaDnxPaymentsPersistence(
      prisma as unknown as DnxPaymentsPrismaDelegates,
    ),
    ...(fetchCanonicalOrder ? { fetchCanonicalOrder } : {}),
    allowCliBypass: false,
    deliveryClass: "HTTP_DELIVERED_FROM_MP",
    environment: "sandbox",
  });

  if (!observed.ok) {
    const unauthorized =
      observed.code === "WEBHOOK_INVALID_SIGNATURE" ||
      observed.code === "WEBHOOK_SECRET_MISSING" ||
      observed.code === "LIVE_MODE_FORBIDDEN" ||
      observed.code === "LIVE_MODE_UNDECLARED";
    const ignored = observed.code === "WEBHOOK_IGNORED_TYPE";
    return {
      ok: false,
      code: observed.code,
      status: unauthorized ? 401 : ignored ? 200 : 400,
    };
  }

  const getCalled = Boolean(fetchCanonicalOrder);
  const canonical = observed.canonical;

  return {
    ok: true,
    status: 200,
    evidence: {
      WEBHOOK_RECEIVED: true,
      SIGNATURE_VALID: true,
      DATA_ID_PRESENT: Boolean(observed.providerOrderId),
      GET_ORDER_CALLED: getCalled,
      GET_ORDER_FOUND: Boolean(canonical),
      GET_ORDER_ID_MATCHES_WEBHOOK:
        Boolean(canonical) && canonical?.providerOrderId === observed.providerOrderId,
      RECONCILIATION: !canonical
        ? "NOT_RUN"
        : observed.mismatches.length === 0
          ? "PASS"
          : "MISMATCH",
      BUSINESS_DECISION_SOURCE: "GET_ORDER",
      BUSINESS_EFFECT: "NONE_OBSERVE_ONLY",
      outcome: observed.outcome,
      providerOrderIdPrefix: observed.providerOrderIdPrefix,
      orderStatus: canonical?.status ?? null,
      orderStatusDetail: canonical?.statusDetail ?? null,
      recipientCount: canonical?.recipientCount ?? null,
      liveMode: observed.liveMode,
      alerts: observed.alerts,
      deliveryClass: observed.deliveryClass,
    },
  };
}
