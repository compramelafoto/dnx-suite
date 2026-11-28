import "server-only";
import { leerCorreoRecibido, type CorreoRecibido } from "./parse";

/**
 * Lectura de los correos recibidos en Resend. Con `fetch` directo (el SDK instalado no trae
 * `emails.receiving`). Ninguna función lanza: devuelven `{ error }`.
 *
 * La clave tiene que ser de acceso completo: una clave "sólo envío" recibe 401 en estos endpoints.
 * Por eso se acepta una aparte, `RESEND_INBOUND_API_KEY`, y si no está se usa `RESEND_API_KEY`.
 */

const BASE = "https://api.resend.com/emails/receiving";
const TIEMPO_MS = 10_000;

export function claveLectura(): string | null {
  return process.env.RESEND_INBOUND_API_KEY?.trim() || process.env.RESEND_API_KEY?.trim() || null;
}

async function pedir(url: string): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  const clave = claveLectura();
  if (!clave) return { ok: false, error: "Falta la clave de Resend (RESEND_API_KEY)." };
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${clave}` },
      signal: AbortSignal.timeout(TIEMPO_MS),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: `Resend respondió ${res.status}: la clave no tiene permiso para leer correos recibidos (hace falta una de acceso completo).` };
    }
    if (!res.ok) {
      const motivo = await res
        .json()
        .then((j: { message?: unknown }) => (typeof j?.message === "string" ? j.message : ""))
        .catch(() => "");
      return { ok: false, error: `Resend respondió ${res.status}${motivo ? `: ${motivo}` : ""}.` };
    }
    return { ok: true, json: await res.json() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `No se pudo hablar con Resend (${e.name}).` : "No se pudo hablar con Resend." };
  }
}

export async function traerCorreo(emailId: string): Promise<CorreoRecibido | { error: string }> {
  const r = await pedir(`${BASE}/${encodeURIComponent(emailId)}`);
  if (!r.ok) return { error: r.error };
  return leerCorreoRecibido(r.json);
}

export type ResumenRecibido = { id: string; to: string[]; cc: string[]; createdAt: string | null };

/** Una página de la lista de recibidos (los más nuevos primero). */
export async function listarRecibidos(opciones: { despuesDe?: string; limite?: number } = {}): Promise<
  { items: ResumenRecibido[]; hayMas: boolean } | { error: string }
> {
  const q = new URLSearchParams({ limit: String(opciones.limite ?? 100) });
  if (opciones.despuesDe) q.set("after", opciones.despuesDe);
  const r = await pedir(`${BASE}?${q}`);
  if (!r.ok) return { error: r.error };
  const cuerpo = r.json as { data?: unknown; has_more?: unknown };
  const items: ResumenRecibido[] = [];
  for (const x of Array.isArray(cuerpo?.data) ? cuerpo.data : []) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string") continue;
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
    items.push({ id: o.id, to: arr(o.to), cc: arr(o.cc), createdAt: typeof o.created_at === "string" ? o.created_at : null });
  }
  return { items, hayMas: cuerpo?.has_more === true };
}

/** Un enlace firmado y temporal para bajar un adjunto. */
export async function enlaceAdjunto(emailId: string, adjuntoId: string): Promise<{ url: string } | { error: string }> {
  const r = await pedir(`${BASE}/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(adjuntoId)}`);
  if (!r.ok) return { error: r.error };
  const url = (r.json as { download_url?: unknown })?.download_url;
  return typeof url === "string" && url.startsWith("https://") ? { url } : { error: "Resend no devolvió el enlace del adjunto." };
}
