import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { SALE_STATEMENT_DESCRIPTOR } from "@repo/muestras";
import {
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  MercadoPagoSplitConsentAdapter,
  createMercadoPagoProviderConfig,
  mapMercadoPagoOrderResponse,
  type MercadoPagoProviderConfig,
} from "@repo/payments/mercado-pago";
import { sanitizeError } from "@repo/payments/mercado-pago-connect";
import { credencialesDeVentas, leerConfigDeVentas } from "./config";

/**
 * Mercado Pago para la venta (etapa 8). Un solo token: el de la aplicación "DNX Suite" (en sandbox,
 * el del usuario de prueba que usa CLF), porque una Order sólo la puede leer quien la creó (D3).
 *
 * - Las escrituras en producción (`allowProductionWrites`) se habilitan sólo en modo `LIVE`.
 * - Nunca se registra el token, el token de la tarjeta ni el documento: todo `catch` pasa por
 *   `sanitizeError`.
 */

type Contexto = { config: MercadoPagoProviderConfig; http: MercadoPagoHttpClient; ownerUserId: string | null };

/**
 * `para`: "ordenes" (crear, devolver, leer) sólo escribe en producción en modo `LIVE`;
 * "consentimientos" (invitar al reparto) escribe en producción con la llave de la suite
 * `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED`, aunque la venta siga apagada: así organización y autores
 * dejan conectado su Mercado Pago antes de que se venda (D13).
 */
function contexto(para: "ordenes" | "consentimientos" = "ordenes"): Contexto | null {
  const cfg = leerConfigDeVentas();
  const cred = credencialesDeVentas();
  if (!cred.accessToken || !cfg.mpEnv) return null;
  const escribeEnProduccion =
    cfg.mpEnv === "production" && (para === "ordenes" ? cfg.modo === "LIVE" : cfg.consentimientoProduccion);
  const config = createMercadoPagoProviderConfig({
    accessToken: cred.accessToken,
    environment: cfg.mpEnv,
    ...(escribeEnProduccion ? { allowProductionWrites: true } : {}),
    ...(cred.publicKey ? { publicKey: cred.publicKey } : {}),
    platformId: "muestras",
    requestTimeoutMs: 15_000,
    maxRetries: 2,
  });
  return { config, http: new MercadoPagoHttpClient(config), ownerUserId: cred.ownerUserId };
}

const log = (que: string, error: unknown) => console.error(`[muestras][ventas] ${que}:`, sanitizeError(error));

/**
 * El adaptador de Orders 1:N, o `null` si falta configuración. La guarda de staging del paquete no
 * aplica (Muestras tiene sus propios modos); la de producción la pone el cliente HTTP.
 */
export function adaptadorDeOrdenes(): MercadoPagoOrdersAdapter | null {
  const c = contexto();
  if (!c?.ownerUserId) return null;
  return new MercadoPagoOrdersAdapter({
    config: c.config,
    httpClient: c.http,
    ownerUserId: c.ownerUserId,
    defaultStatementDescriptor: SALE_STATEMENT_DESCRIPTOR,
    enforceOrders1nStagingGate: false,
  });
}

/** Ambiente de las escrituras (para `createSplitOrder`): el mismo del token. */
export function ambienteDeMercadoPago(): "sandbox" | "production" | null {
  return leerConfigDeVentas().mpEnv;
}

const ID_ORDEN_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** "1275.5" → 127550. Sólo dígitos y a lo sumo dos decimales; otra cosa → null. */
function aCentavos(monto: string | undefined | null): number | null {
  if (monto == null) return null;
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(String(monto).trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export type OrdenLeida = {
  providerOrderId: string;
  /** Estado traducido por el paquete: `PROCESSED_ACCREDITED`, `OPEN`, `REFUNDED`, … */
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
  totalCents: number | null;
  splits: { receiverId: string; type: string; cents: number | null }[];
  paymentStatus: string | null;
  liveMode: boolean | null;
};

type OrdenCruda = {
  id: string;
  status: string;
  status_detail?: string;
  external_reference?: string;
  total_amount?: string;
  live_mode?: boolean;
  splits?: { receiver_id: string; receiver_type: string; amount: string }[];
  transactions?: { payments?: { id: string; status: string; status_detail?: string; amount?: string }[] };
};

/**
 * `GET /v1/orders/{id}`: la única fuente de verdad del estado de un pedido (D29). `null` si no se
 * pudo leer (sin configuración, id raro, error de red o de Mercado Pago): quien llama no cambia nada.
 */
export async function leerOrden(providerOrderId: string): Promise<OrdenLeida | null> {
  if (!ID_ORDEN_RE.test(providerOrderId)) return null;
  const c = contexto();
  if (!c) return null;
  try {
    const r = await c.http.request<OrdenCruda>({ method: "GET", path: `/v1/orders/${providerOrderId}` });
    const body = r.body;
    if (!body?.id) return null;
    const mapeada = mapMercadoPagoOrderResponse(body as Parameters<typeof mapMercadoPagoOrderResponse>[0]);
    return {
      providerOrderId: body.id,
      status: mapeada.status,
      statusDetail: mapeada.statusDetail ?? null,
      externalReference: body.external_reference ?? null,
      totalCents: aCentavos(body.total_amount),
      splits: (body.splits ?? []).map((s) => ({ receiverId: String(s.receiver_id), type: s.receiver_type, cents: aCentavos(s.amount) })),
      paymentStatus: body.transactions?.payments?.[0]?.status ?? null,
      liveMode: typeof body.live_mode === "boolean" ? body.live_mode : null,
    };
  } catch (error) {
    log("leer orden", error);
    return null;
  }
}

export type Consentimiento = { receiverId: string; status: string; inviteUrl: string | null };

/**
 * Pide el consentimiento de reparto para la cuenta de ese email (`POST /v1/split-consent`), con el
 * token de la plataforma. En producción exige `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED`.
 */
export async function invitarAReparto(email: string): Promise<Consentimiento | { error: string }> {
  const cfg = leerConfigDeVentas();
  const c = contexto("consentimientos");
  if (!c || !cfg.mpEnv) return { error: "Falta configurar Mercado Pago en la plataforma." };
  if (cfg.mpEnv === "production" && !cfg.consentimientoProduccion) return { error: "Mercado Pago todavía no habilitó esta función." };
  try {
    const adaptador = new MercadoPagoSplitConsentAdapter({ config: c.config, httpClient: c.http });
    const r = await adaptador.invite({ environment: cfg.mpEnv, sellerEmails: [email], idempotencyKey: randomUUID() });
    const primero = r[0];
    if (!primero?.receiverId) return { error: "Mercado Pago no pudo invitar a ese email. Revisá que sea el de tu cuenta." };
    return { receiverId: primero.receiverId, status: primero.status, inviteUrl: primero.inviteUrl ?? null };
  } catch (error) {
    log("invitar al reparto", error);
    return { error: "Mercado Pago no aceptó el pedido. Probá de nuevo en unos minutos." };
  }
}

/** Estado actual de un consentimiento en Mercado Pago, o `null` si no se pudo leer. */
export async function leerConsentimiento(receiverId: string): Promise<Consentimiento | null> {
  if (!ID_ORDEN_RE.test(receiverId)) return null;
  const c = contexto("consentimientos");
  if (!c) return null;
  try {
    const r = await new MercadoPagoSplitConsentAdapter({ config: c.config, httpClient: c.http }).getConsent(receiverId);
    if (!r) return null;
    return { receiverId: r.receiverId, status: r.status, inviteUrl: r.inviteUrl ?? null };
  } catch (error) {
    log("leer consentimiento", error);
    return null;
  }
}

/**
 * Devolución total de una Order con reparto (la parcial falla en Mercado Pago, D27). En producción
 * sólo en modo `LIVE`; el cliente HTTP frena cualquier otra escritura.
 */
export async function devolverTotal(providerOrderId: string, idempotencyKey: string): Promise<{ ok: true; orderStatus: string } | { ok: false; error: string }> {
  if (!ID_ORDEN_RE.test(providerOrderId)) return { ok: false, error: "Pedido sin orden de Mercado Pago." };
  const cfg = leerConfigDeVentas();
  if (cfg.mpEnv === "production" && cfg.modo !== "LIVE") return { ok: false, error: "La venta en vivo está apagada: no se puede devolver desde acá." };
  const adaptador = adaptadorDeOrdenes();
  if (!adaptador) return { ok: false, error: "Falta configurar Mercado Pago en la plataforma." };
  try {
    const r = await adaptador.refund({ providerOrderId, idempotencyKey });
    return { ok: true, orderStatus: r.orderStatus ?? "unknown" };
  } catch (error) {
    log("devolver", error);
    return { ok: false, error: "Mercado Pago no aceptó la devolución. Probá de nuevo en unos minutos." };
  }
}

export type CuentaDelToken = { id: string; esDePrueba: boolean };

const CUENTA_OK_MS = 60 * 60_000;
const CUENTA_FALLA_MS = 60_000;
let cacheCuenta: { huella: string; valor: CuentaDelToken | null; vence: number } | null = null;

/** Para los tests: olvida la cuenta guardada. */
export async function olvidarCuentaDelToken(): Promise<void> {
  cacheCuenta = null;
}

/**
 * `GET /users/me` con el token de la venta: el id de la cuenta y si es un usuario de prueba de
 * Mercado Pago (etiqueta `test_user`). Se guarda una hora (un minuto si falló). `null` si no se pudo
 * leer. Sirve para no vender en "prueba" con una cuenta real, ni en vivo con una de prueba.
 */
export async function cuentaDelToken(ahora = Date.now()): Promise<CuentaDelToken | null> {
  const c = contexto();
  const token = credencialesDeVentas().accessToken;
  if (!c || !token) return null;
  const huella = createHash("sha256").update(token).digest("hex").slice(0, 16);
  if (cacheCuenta && cacheCuenta.huella === huella && cacheCuenta.vence > ahora) return cacheCuenta.valor;
  let valor: CuentaDelToken | null = null;
  try {
    const r = await c.http.request<{ id?: number | string; tags?: unknown }>({ method: "GET", path: "/users/me" });
    const id = r.body?.id;
    if (id != null && /^\d{1,20}$/.test(String(id))) {
      const tags = Array.isArray(r.body?.tags) ? (r.body!.tags as unknown[]).map(String) : [];
      valor = { id: String(id), esDePrueba: tags.includes("test_user") };
    }
  } catch (error) {
    log("leer la cuenta del token", error);
  }
  cacheCuenta = { huella, valor, vence: ahora + (valor ? CUENTA_OK_MS : CUENTA_FALLA_MS) };
  return valor;
}
