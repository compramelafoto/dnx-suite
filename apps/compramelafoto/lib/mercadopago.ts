/**
 * Librería centralizada para integración con Mercado Pago
 * Soporta modo TEST y PRODUCCIÓN
 */

const MP_API_BASE = "https://api.mercadopago.com";

/** Error de la API de Mercado Pago con el status HTTP a mano (401 = token vencido/revocado). */
export class MercadoPagoApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "MercadoPagoApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Obtiene el access token de Mercado Pago desde variables de entorno
 */
function getAccessToken(overrideToken?: string): string {
  if (overrideToken) {
    return overrideToken;
  }
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MP_ACCESS_TOKEN no está configurado en .env");
  }
  return token;
}

/**
 * Credencial tipo Access Token de prueba (`TEST-...`). Checkout Pro muestra sandbox.
 * Tokens OAuth de vendedores en producción suelen ser `APP_USR-...` u otros prefijos distintos.
 */
export function mercadoPagoAccessTokenIsTestCredential(token: string): boolean {
  return token.trim().startsWith("TEST-");
}

/** Host tipo sandbox.mercadopago.* / sandbox.mercadolibre.* (Checkout Pro de prueba). */
export function mercadoPagoCheckoutUrlLooksLikeSandbox(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("sandbox.mercadopago") || host.includes("sandbox.mercadolibre");
  } catch {
    return false;
  }
}

/**
 * Verifica si estamos en modo TEST
 */
function isTestMode(overrideToken?: string): boolean {
  const token = getAccessToken(overrideToken);
  return mercadoPagoAccessTokenIsTestCredential(token);
}

/**
 * Verifica si estamos en desarrollo local
 */
function isLocalDevelopment(): boolean {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
}

/**
 * Tipo de pedido para metadata
 */
export type OrderType =
  | "PRINT_ORDER"
  | "ALBUM_ORDER"
  | "PRECOMPRA_ORDER"
  /** Curso Funes (DNX): en producción solo `MP_ACCESS_TOKEN` de la aplicación (sin OAuth fotógrafo); sin `marketplace_fee` de plataforma en esta preferencia. */
  | "DNX_COURSE_ENROLLMENT";

/**
 * Parámetros para crear una preferencia de pago
 */
export interface CreatePreferenceParams {
  title: string;
  total: number; // ARS enteros (sin centavos)
  marketplaceFee?: number; // ARS enteros (sin centavos)
  externalReference: string; // ID del pedido como string
  metadata: {
    orderType: OrderType;
    orderId: number;
    [key: string]: any;
  };
}

/**
 * Respuesta de creación de preferencia
 */
export interface CreatePreferenceResponse {
  initPoint: string; // URL de checkout
  preferenceId: string; // ID de la preferencia
}

/**
 * Crea una preferencia de pago en Mercado Pago
 */
export async function createPreference(
  params: CreatePreferenceParams,
  options?: {
    accessTokenOverride?: string;
    /**
     * Producción (NODE_ENV): rechazar token TEST-, solo sandbox_init_point o URL de checkout sandbox.
     * Usado por el curso DNX para no redirigir nunca a sandbox en compramelafoto.com.
     */
    forbidSandboxCheckoutUrl?: boolean;
    /**
     * CLF-MP-OAUTH-REFRESH-100: si Mercado Pago responde 401 (access token OAuth vencido),
     * se pide un token nuevo con el refresh token y se reintenta una sola vez.
     * Devolver `null` significa que el vendedor tiene que reconectar Mercado Pago.
     */
    refreshAccessTokenOnUnauthorized?: () => Promise<string | null>;
  }
): Promise<CreatePreferenceResponse> {
  const token = getAccessToken(options?.accessTokenOverride);
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const isLocal = isLocalDevelopment();
  const isProdRuntime = process.env.NODE_ENV === "production";
  const lockProdCheckout = Boolean(options?.forbidSandboxCheckoutUrl && isProdRuntime);

  if (lockProdCheckout && mercadoPagoAccessTokenIsTestCredential(token)) {
    console.error(
      "[MP createPreference] SANDBOX CREDENTIAL: Access Token con prefijo TEST- no permitido para este checkout en producción. Configurá MP_ACCESS_TOKEN de producción (APP_USR-...).",
      { orderType: params.metadata.orderType, orderId: params.metadata.orderId }
    );
    throw new Error(
      "Mercado Pago: credencial de prueba (TEST-) no permitida en producción para este pago. Configurá MP_ACCESS_TOKEN de producción."
    );
  }

  if (isProdRuntime && mercadoPagoAccessTokenIsTestCredential(token)) {
    console.error(
      "[MP createPreference] SANDBOX CREDENTIAL: el Access Token empieza con TEST-; el checkout será sandbox hasta usar credencial APP_USR de producción.",
      { orderType: params.metadata.orderType, orderId: params.metadata.orderId }
    );
  }

  // Construir URLs de retorno
  const successUrl = `${appUrl}/pago/success?orderId=${params.metadata.orderId}&orderType=${params.metadata.orderType}`;
  const failureUrl = `${appUrl}/pago/failure?orderId=${params.metadata.orderId}&orderType=${params.metadata.orderType}`;
  const pendingUrl = `${appUrl}/pago/pending?orderId=${params.metadata.orderId}&orderType=${params.metadata.orderType}`;

  console.log("MP Preference URLs:", { successUrl, failureUrl, pendingUrl, appUrl, isLocal, isTest: isTestMode(options?.accessTokenOverride), total: params.total });

  // Validar que el monto sea válido
  if (!params.total || params.total <= 0) {
    throw new Error(`El monto debe ser mayor a 0. Recibido: ${params.total}`);
  }

  // MP recomienda id, description y category_id para mejorar aprobación y reducir rechazos por antifraude
  const itemId = `ORD-${params.metadata.orderType}-${params.metadata.orderId}`;
  const itemDescription = params.title.length > 256 ? params.title.substring(0, 253) + "..." : params.title;

  const preferenceBody: any = {
    items: [
      {
        id: itemId,
        title: params.title,
        description: itemDescription,
        category_id: "others", // Categoría genérica para servicios (fotos, impresión)
        quantity: 1,
        unit_price: Number(params.total), // ARS enteros - asegurar que sea número
        currency_id: "ARS",
      },
    ],
    ...(Number.isFinite(params.marketplaceFee) && params.marketplaceFee && params.marketplaceFee > 0
      ? { marketplace_fee: Number(params.marketplaceFee) }
      : {}),
    metadata: params.metadata,
    external_reference: params.externalReference,
    // Descripción en el resumen de tarjeta (máx 13 chars) - reduce desconocimientos y contracargos
    statement_descriptor: (process.env.MP_STATEMENT_DESCRIPTOR || "COMPRAMEFOTO").substring(0, 13),
    back_urls: {
      success: successUrl,
      failure: failureUrl,
      pending: pendingUrl,
    },
  };

  // IMPORTANTE: En desarrollo local con localhost, Mercado Pago puede bloquear el botón
  // si las URLs no son accesibles públicamente. Para solucionarlo:
  // 1. Usar ngrok o similar para exponer localhost públicamente
  // 2. O simplemente no usar auto_return (el usuario volverá manualmente)
  // 3. O usar una URL pública de prueba
  
  // Solo usar auto_return en producción (no localhost)
  // En desarrollo, el usuario puede volver manualmente usando las back_urls
  if (!isLocal) {
    preferenceBody.auto_return = "approved";
  }

  // Webhook: siempre que la app sea accesible por MP (no localhost).
  // Si usás token TEST en producción, MP igual puede notificar si la URL es pública.
  if (!isLocal) {
    const notificationUrl = new URL(`${appUrl}/api/payments/mp/webhook`);
    notificationUrl.searchParams.set("orderId", String(params.metadata.orderId));
    notificationUrl.searchParams.set("orderType", String(params.metadata.orderType));
    preferenceBody.notification_url = notificationUrl.toString();
  }

  async function postPreference(bearer: string) {
    const res = await fetch(`${MP_API_BASE}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody),
    });
    return { res, body: await res.json().catch(() => ({})) };
  }

  let { res: response, data } = await postPreference(token).then((r) => ({
    res: r.res,
    data: r.body as any,
  }));

  // Access token OAuth vencido: renovarlo con el refresh token y reintentar una vez.
  if (response.status === 401 && options?.refreshAccessTokenOnUnauthorized) {
    console.warn(
      "[MP createPreference] 401 de Mercado Pago: intentando renovar el access token OAuth",
      { orderType: params.metadata.orderType, orderId: params.metadata.orderId }
    );
    const refreshedToken = await options.refreshAccessTokenOnUnauthorized();
    if (refreshedToken) {
      const retry = await postPreference(refreshedToken);
      response = retry.res;
      data = retry.body as any;
    }
  }

  if (!response.ok) {
    console.error("MP CREATE PREFERENCE ERROR:", data);
    throw new MercadoPagoApiError(
      `Error creando preferencia en Mercado Pago: ${JSON.stringify(data)}`,
      response.status,
      data
    );
  }

  const preferenceId = data.id as string | undefined;

  const rawProd =
    typeof data.init_point === "string" && data.init_point.trim().length > 0
      ? data.init_point.trim()
      : undefined;
  const rawSandbox =
    typeof data.sandbox_init_point === "string" && data.sandbox_init_point.trim().length > 0
      ? data.sandbox_init_point.trim()
      : undefined;

  /** MP puede devolver ambos: usar siempre `init_point` (checkout real) cuando existe. */
  const initPoint = rawProd ?? rawSandbox;

  if (!initPoint || !preferenceId) {
    throw new Error("Mercado Pago no retornó init_point / sandbox_init_point ni preferenceId");
  }

  if (lockProdCheckout) {
    if (!rawProd && rawSandbox) {
      console.error(
        "[MP createPreference] La preferencia solo incluye sandbox_init_point (sin init_point de producción). Revisá MP_ACCESS_TOKEN APP_USR y que la aplicación MP esté en modo producción.",
        { preferenceId, orderType: params.metadata.orderType, orderId: params.metadata.orderId }
      );
      throw new Error(
        "Mercado Pago devolvió solo enlace de prueba (sandbox). Configurá credenciales de producción (APP_USR-…)."
      );
    }
    if (mercadoPagoCheckoutUrlLooksLikeSandbox(initPoint)) {
      console.error(
        "[MP createPreference] URL de checkout apunta a dominio sandbox en producción.",
        { preferenceId, orderType: params.metadata.orderType, orderId: params.metadata.orderId }
      );
      throw new Error(
        "La URL de pago es de sandbox. Verificá MP_ACCESS_TOKEN de producción en el servidor."
      );
    }
  }

  return {
    initPoint,
    preferenceId,
  };
}

/**
 * Estado de pago en Mercado Pago
 */
export type PaymentStatus = "approved" | "rejected" | "pending" | "in_process" | "cancelled" | "refunded" | "charged_back";

/**
 * Información de un pago en Mercado Pago
 */
export interface PaymentInfo {
  id: string;
  status: PaymentStatus;
  status_detail: string;
  external_reference: string;
  transaction_amount: number;
  currency_id: string;
  date_created: string;
  date_approved: string | null;
  metadata?: Record<string, any>;
}

/**
 * Obtiene información de un pago por su ID
 */
export async function getPaymentById(
  paymentId: string,
  options?: { accessTokenOverride?: string }
): Promise<PaymentInfo> {
  const token = getAccessToken(options?.accessTokenOverride);

  const response = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("MP GET PAYMENT ERROR:", data);
    throw new Error(
      `Error obteniendo pago de Mercado Pago: ${JSON.stringify(data)}`
    );
  }

  return {
    id: data.id as string,
    status: data.status as PaymentStatus,
    status_detail: data.status_detail as string,
    external_reference: data.external_reference as string,
    transaction_amount: data.transaction_amount as number,
    currency_id: data.currency_id as string,
    date_created: data.date_created as string,
    date_approved: data.date_approved as string | null,
    metadata: data.metadata as Record<string, any> | undefined,
  };
}

/**
 * Busca pagos por external_reference (ej. ID del pedido).
 * Requiere sort, criteria, range y fechas. Devuelve el primer resultado aprobado o el más reciente.
 */
export async function searchPaymentsByExternalReference(
  externalReference: string,
  options?: { accessTokenOverride?: string; dateRangeDays?: number }
): Promise<PaymentInfo[]> {
  const token = getAccessToken(options?.accessTokenOverride);
  const days = options?.dateRangeDays ?? 365;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const format = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, ".000Z");
  const params = new URLSearchParams({
    sort: "date_created",
    criteria: "desc",
    external_reference: externalReference,
    range: "date_created",
    begin_date: format(start),
    end_date: format(end),
  });

  const response = await fetch(`${MP_API_BASE}/v1/payments/search?${params}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("MP SEARCH PAYMENTS ERROR:", data);
    throw new Error(`Error buscando pagos en Mercado Pago: ${JSON.stringify(data)}`);
  }

  const wrapper = Array.isArray(data) ? data[0] : data;
  const results = wrapper?.results ?? [];
  return results.map((r: any) => ({
    id: String(r.id),
    status: r.status as PaymentStatus,
    status_detail: (r.status_detail ?? "") as string,
    external_reference: (r.external_reference ?? externalReference) as string,
    transaction_amount: Number(r.transaction_amount ?? 0),
    currency_id: (r.currency_id ?? "ARS") as string,
    date_created: (r.date_created ?? "") as string,
    date_approved: (r.date_approved ?? null) as string | null,
    metadata: (r.metadata ?? {}) as Record<string, any>,
  }));
}

/**
 * Mapea el estado de Mercado Pago al estado interno del sistema
 */
export function mapPaymentStatusToOrderStatus(
  mpStatus: PaymentStatus
): "PAID" | "FAILED" | "PENDING" {
  switch (mpStatus) {
    case "approved":
      return "PAID";
    case "rejected":
    case "cancelled":
      return "FAILED";
    case "pending":
    case "in_process":
      return "PENDING";
    case "refunded":
    case "charged_back":
      // Estos estados se manejan por separado
      return "FAILED";
    default:
      return "PENDING";
  }
}

/**
 * Mapea el estado de Mercado Pago al estado de pago interno
 */
export function mapPaymentStatusToPaymentStatus(
  mpStatus: PaymentStatus
): "PAID" | "FAILED" | "PENDING" | "REFUNDED" {
  switch (mpStatus) {
    case "approved":
      return "PAID";
    case "rejected":
    case "cancelled":
      return "FAILED";
    case "pending":
    case "in_process":
      return "PENDING";
    case "refunded":
      return "REFUNDED";
    case "charged_back":
      return "FAILED";
    default:
      return "PENDING";
  }
}
