import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Los avisos de Cloudflare sobre la transmisión, verificados y traducidos.
 *
 * Cloudflare avisa por dos caminos distintos, y la misma ruta los recibe a los dos:
 *
 * 1. **Webhook de Stream** (videos): se registra con `PUT /accounts/{id}/stream/webhook` y firma
 *    cada aviso con el encabezado `Webhook-Signature: time=<unix>,sig1=<hex>`, donde `sig1` es
 *    HMAC-SHA256 (hex) de `"<time>.<cuerpo crudo>"` con el secreto que devuelve ese registro.
 *    Avisa cuando la grabación de un vivo queda lista (o falla). El video trae `liveInput`.
 * 2. **Notificaciones de Cloudflare** (live input conectado / desconectado / con error): se
 *    configuran en el panel → Notifications con un destino webhook. Ese destino manda el
 *    secreto que uno elige en el encabezado `cf-webhook-auth`, sin firma.
 *
 * Un solo secreto para los dos (`STREAM_WEBHOOK_SECRET`): el del punto 1 lo genera Cloudflare y
 * es el que se pega también como secreto del destino del punto 2.
 *
 * Fuentes (10/11/2026):
 * - https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/
 * - https://developers.cloudflare.com/stream/stream-live/webhooks/
 * - https://developers.cloudflare.com/notifications/get-started/configure-webhooks/
 *
 * Módulo PURO: sin base y sin red.
 */

/** Cinco minutos: un aviso más viejo que eso se descarta (repetición de un aviso capturado). */
export const TOLERANCIA_SEGUNDOS = 5 * 60;

function igualesSinFiltrar(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export type Verificacion = { ok: true } | { ok: false; motivo: string };

/** Firma del webhook de Stream (`Webhook-Signature`). */
export function verificarFirmaStream(input: {
  secreto: string;
  encabezado: string | null;
  cuerpo: string;
  ahoraSegundos: number;
}): Verificacion {
  if (!input.encabezado) return { ok: false, motivo: "sin firma" };
  const partes = new Map<string, string>();
  for (const trozo of input.encabezado.split(",")) {
    const i = trozo.indexOf("=");
    if (i > 0) partes.set(trozo.slice(0, i).trim(), trozo.slice(i + 1).trim());
  }
  const time = partes.get("time");
  const sig1 = partes.get("sig1");
  if (!time || !sig1 || !/^\d+$/.test(time)) return { ok: false, motivo: "firma mal formada" };
  if (Math.abs(input.ahoraSegundos - Number(time)) > TOLERANCIA_SEGUNDOS) {
    return { ok: false, motivo: "aviso vencido" };
  }
  const esperada = createHmac("sha256", input.secreto).update(`${time}.${input.cuerpo}`).digest("hex");
  return igualesSinFiltrar(esperada, sig1.toLowerCase()) ? { ok: true } : { ok: false, motivo: "firma inválida" };
}

/** Secreto de las Notificaciones de Cloudflare (`cf-webhook-auth`). */
export function verificarSecretoNotificacion(input: { secreto: string; encabezado: string | null }): Verificacion {
  if (!input.encabezado) return { ok: false, motivo: "sin secreto" };
  return igualesSinFiltrar(input.secreto, input.encabezado.trim())
    ? { ok: true }
    : { ok: false, motivo: "secreto inválido" };
}

export type AvisoStream =
  | { tipo: "SENAL"; conectada: true; liveInputUid: string; at: Date }
  | { tipo: "SENAL"; conectada: false; liveInputUid: string; at: Date }
  | { tipo: "ERROR_SENAL"; liveInputUid: string; at: Date; detalle: string }
  | {
      tipo: "GRABACION";
      videoUid: string;
      liveInputUid: string;
      estado: "LISTA" | "ERROR" | "PROCESANDO";
      durationSeconds: number | null;
      thumbnailUrl: string | null;
      creado: Date | null;
    };

function fecha(valor: unknown, porDefecto: Date): Date {
  if (typeof valor === "string" || typeof valor === "number") {
    const d = new Date(typeof valor === "number" ? valor * 1000 : valor);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return porDefecto;
}

/**
 * Traduce el cuerpo de cualquiera de los dos avisos. `null` = no es nuestro (un video subido a
 * un curso, un tipo de aviso que no usamos): se confirma igual para que Cloudflare no reintente.
 */
export function leerAviso(cuerpo: unknown, ahora: Date): AvisoStream | null {
  if (!cuerpo || typeof cuerpo !== "object") return null;
  const r = cuerpo as Record<string, unknown>;

  // Notificación de live input: { data: { input_id, event_type, updated_at, live_input_errored? } }
  if (r.data && typeof r.data === "object") {
    const d = r.data as Record<string, unknown>;
    const uid = typeof d.input_id === "string" ? d.input_id : null;
    if (!uid) return null;
    const at = fecha(d.updated_at, ahora);
    switch (d.event_type) {
      case "live_input.connected":
        return { tipo: "SENAL", conectada: true, liveInputUid: uid, at };
      case "live_input.disconnected":
        return { tipo: "SENAL", conectada: false, liveInputUid: uid, at };
      case "live_input.errored": {
        const err = (d.live_input_errored as { error?: { code?: unknown; message?: unknown } } | undefined)?.error;
        const detalle = [err?.code, err?.message]
          .filter((x): x is string => typeof x === "string")
          .join(": ")
          .slice(0, 300);
        return { tipo: "ERROR_SENAL", liveInputUid: uid, at, detalle: detalle || "error sin detalle" };
      }
      default:
        return null;
    }
  }

  // Webhook de video: { uid, liveInput, readyToStream, status: { state }, duration, thumbnail, created }
  if (typeof r.uid === "string" && typeof r.liveInput === "string" && r.liveInput) {
    const state = (r.status as { state?: unknown } | undefined)?.state;
    const estado = state === "ready" ? "LISTA" : state === "error" ? "ERROR" : "PROCESANDO";
    return {
      tipo: "GRABACION",
      videoUid: r.uid,
      liveInputUid: r.liveInput,
      estado,
      durationSeconds: estado === "LISTA" && typeof r.duration === "number" && r.duration > 0 ? Math.round(r.duration) : null,
      thumbnailUrl: estado === "LISTA" && typeof r.thumbnail === "string" ? r.thumbnail : null,
      creado: typeof r.created === "string" ? fecha(r.created, ahora) : null,
    };
  }
  return null;
}
