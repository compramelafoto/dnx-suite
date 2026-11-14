import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * API de conversiones de Meta (aviso servidor → servidor).
 *
 * Mide el recorrido del FOTÓGRAFO, que es el cliente de CLF:
 *   1. CompleteRegistration — se registró como fotógrafo.
 *   2. PrimerAlbum          — creó su primer álbum.
 *   3. PrimeraVenta         — vendió por primera vez (cliente ganado), con el importe.
 *
 * La primera venta ocurre mientras el que está en la página es el comprador, así que el píxel
 * del navegador no la puede ver: por eso todo esto sale desde el servidor.
 *
 * Se enciende con NEXT_PUBLIC_META_PIXEL_ID + META_CAPI_ACCESS_TOKEN. Sin alguna de las dos no
 * se manda nada. META_CAPI_TEST_EVENT_CODE (opcional) manda los eventos a "Probar eventos".
 * Nunca lanza errores: la medición no puede frenar un registro, un álbum ni un cobro.
 */

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION?.trim() || "v24.0";
const TIMEOUT_MS = 4000;

export type MetaServerEventName = "CompleteRegistration" | "PrimerAlbum" | "PrimeraVenta" | "Lead";

/** Lo mínimo que se lee del pedido HTTP (sirve un NextRequest o un Request). */
type RequestLike = {
  headers: { get(name: string): string | null };
};

export type MetaServerEventInput = {
  eventName: MetaServerEventName;
  /** Identificador estable: Meta descarta repetidos con el mismo id. */
  eventId: string;
  /** `id` es el usuario de CLF; un inscripto a una charla todavía no tiene cuenta. */
  user: { id?: number | null; email: string | null | undefined; phone?: string | null };
  /** Pedido del navegador del fotógrafo (registro, álbum). No existe en la primera venta. */
  req?: RequestLike | null;
  customData?: Record<string, unknown>;
  eventSourceUrl?: string;
};

export function getMetaCapiConfig(): { pixelId: string; token: string; testCode: string | null } | null {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!pixelId || !/^\d{5,20}$/.test(pixelId) || !token) return null;
  return { pixelId, token, testCode: process.env.META_CAPI_TEST_EVENT_CODE?.trim() || null };
}

export function sha256Normalized(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  return createHash("sha256").update(v).digest("hex");
}

/** Teléfono a solo dígitos con código de país (Argentina por defecto), como pide Meta. */
export function normalizePhoneForMeta(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("54")) return digits;
  return `54${digits.replace(/^0/, "")}`;
}

function readCookie(req: RequestLike, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function clientIp(req: RequestLike): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || null;
  return req.headers.get("x-real-ip");
}

export function buildMetaServerEvent(input: MetaServerEventInput, nowMs = Date.now()) {
  const userData: Record<string, unknown> = {};
  const em = sha256Normalized(input.user.email);
  if (em) userData.em = [em];
  const ph = sha256Normalized(normalizePhoneForMeta(input.user.phone));
  if (ph) userData.ph = [ph];
  if (input.user.id != null) userData.external_id = [sha256Normalized(`clf-user-${input.user.id}`)];

  if (input.req) {
    const fbp = readCookie(input.req, "_fbp");
    const fbc = readCookie(input.req, "_fbc");
    const ip = clientIp(input.req);
    const ua = input.req.headers.get("user-agent");
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;
    if (ip) userData.client_ip_address = ip;
    if (ua) userData.client_user_agent = ua;
  }

  // Con navegador del fotógrafo es "website"; la primera venta la genera el sistema.
  const fromBrowser = Boolean(input.req && userData.client_user_agent);

  return {
    event_name: input.eventName,
    event_time: Math.floor(nowMs / 1000),
    event_id: input.eventId,
    action_source: fromBrowser ? "website" : "system_generated",
    ...(fromBrowser && input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
    user_data: userData,
    ...(input.customData ? { custom_data: input.customData } : {}),
  };
}

export async function sendMetaServerEvent(input: MetaServerEventInput): Promise<boolean> {
  const cfg = getMetaCapiConfig();
  if (!cfg) return false;
  try {
    const body = {
      data: [buildMetaServerEvent(input)],
      ...(cfg.testCode ? { test_event_code: cfg.testCode } : {}),
    };
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.pixelId}/events?access_token=${encodeURIComponent(cfg.token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[meta-capi] rechazado", input.eventName, res.status, text.slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[meta-capi] no se pudo enviar", input.eventName, err);
    return false;
  }
}

function siteUrl(path: string): string | undefined {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return base ? `${base}${path}` : undefined;
}

const PHOTOGRAPHER_ROLES = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);

/** 1. Alta de fotógrafo (formulario o Google). */
export async function reportPhotographerSignup(params: {
  user: { id: number; email: string; role: string; phone?: string | null };
  req: RequestLike;
  method: "formulario" | "google";
}): Promise<void> {
  if (!PHOTOGRAPHER_ROLES.has(params.user.role)) return;
  await sendMetaServerEvent({
    eventName: "CompleteRegistration",
    eventId: `registro-fotografo-${params.user.id}`,
    user: params.user,
    req: params.req,
    eventSourceUrl: siteUrl("/registro"),
    customData: { content_name: "fotografo", status: "registrado", method: params.method },
  });
}

/** 2. Primer álbum real (no de prueba) del fotógrafo. */
export async function reportFirstAlbumIfAny(params: {
  userId: number;
  albumId: number;
  req: RequestLike;
}): Promise<void> {
  if (!getMetaCapiConfig()) return;
  try {
    const albums = await prisma.album.count({
      where: { userId: params.userId, isTest: false, deletedAt: null },
    });
    if (albums !== 1) return;
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, email: true, phone: true },
    });
    if (!user) return;
    await sendMetaServerEvent({
      eventName: "PrimerAlbum",
      eventId: `primer-album-${user.id}`,
      user,
      req: params.req,
      eventSourceUrl: siteUrl("/dashboard/albums"),
      customData: { content_name: "primer_album", content_ids: [String(params.albumId)] },
    });
  } catch (err) {
    console.error("[meta-capi] primer álbum", err);
  }
}

/**
 * 3. Primera venta cobrada del fotógrafo: el "cliente ganado".
 * Cuenta pedidos pagados en sus álbumes reales; si éste es el único, es la primera.
 * Si dos caminos (aviso de Mercado Pago y pantalla de éxito) llegan juntos, el mismo
 * event_id hace que Meta lo cuente una sola vez.
 */
export async function reportFirstSaleIfAny(orderId: number): Promise<void> {
  if (!getMetaCapiConfig()) return;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        isTest: true,
        totalCents: true,
        currency: true,
        album: {
          select: {
            isTest: true,
            user: { select: { id: true, email: true, phone: true, role: true } },
          },
        },
      },
    });
    const photographer = order?.album?.user;
    if (!order || order.status !== "PAID" || order.isTest || order.album?.isTest || !photographer) return;
    if (!PHOTOGRAPHER_ROLES.has(String(photographer.role))) return;

    const paidOrders = await prisma.order.count({
      where: {
        status: "PAID",
        isTest: false,
        album: { userId: photographer.id, isTest: false },
      },
    });
    if (paidOrders !== 1) return;

    await sendMetaServerEvent({
      eventName: "PrimeraVenta",
      eventId: `primera-venta-${photographer.id}`,
      user: photographer,
      customData: {
        // En CLF totalCents guarda pesos enteros, no centavos.
        value: order.totalCents,
        currency: (order.currency || "ARS").toUpperCase(),
        content_name: "primera_venta",
        order_id: String(order.id),
      },
    });
  } catch (err) {
    console.error("[meta-capi] primera venta", err);
  }
}

/**
 * Inscripción a una charla gratuita: es el "Lead" con el que optimiza la campaña principal.
 * El navegador manda el mismo evento con el mismo event_id y Meta se queda con uno solo.
 */
export async function reportTalkLead(params: {
  leadId: number;
  talkSlug: string;
  email: string;
  phone?: string | null;
  req: RequestLike;
}): Promise<void> {
  await sendMetaServerEvent({
    eventName: "Lead",
    eventId: `charla-lead-${params.leadId}`,
    user: { email: params.email, phone: params.phone },
    req: params.req,
    eventSourceUrl: siteUrl(`/${params.talkSlug}`),
    customData: { content_name: params.talkSlug, content_category: "charla" },
  });
}
