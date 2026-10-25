import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Lo que llega al webhook de Telegram, verificado y leído. Módulo PURO (sólo `node:crypto`).
 *
 * - El secreto: lo elegimos nosotros al registrar el webhook (`secret_token` de setWebhook) y
 *   Telegram lo manda en cada aviso en `X-Telegram-Bot-Api-Secret-Token`. Se guarda sólo su SHA-256
 *   y se compara en tiempo constante.
 * - Sólo interesan dos cosas: `/start <código>` en un chat privado (vincular el chat de Daniel) y
 *   el toque de un botón (`callback_query`). Todo lo demás se confirma con 200 y se ignora.
 */

export const ENCABEZADO_SECRETO = "x-telegram-bot-api-secret-token";

/** Secreto nuevo para setWebhook: 64 caracteres hex (Telegram admite A-Z, a-z, 0-9, _ y -). */
export function secretoNuevo(): string {
  return randomBytes(32).toString("hex");
}

export function hashDeSecreto(secreto: string): string {
  return createHash("sha256").update(secreto, "utf8").digest("hex");
}

/** ¿El encabezado trae el secreto cuyo hash guardamos? Sin encabezado o sin hash, no. */
export function secretoValido(encabezado: string | null | undefined, hashGuardado: string | null | undefined): boolean {
  if (!encabezado || !hashGuardado || encabezado.length > 256) return false;
  const a = Buffer.from(hashDeSecreto(encabezado), "hex");
  const b = Buffer.from(hashGuardado, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Código de vínculo: 10 caracteres sin letras que se confundan (va en el enlace t.me/<bot>?start=…). */
export function codigoDeVinculo(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => letras[b % letras.length]).join("");
}

export type UpdateTelegram =
  | { tipo: "START"; chatId: string; chatPrivado: boolean; codigo: string | null; nombre: string | null }
  | { tipo: "BOTON"; callbackId: string; chatId: string | null; deId: string; messageId: string | null; data: string }
  | { tipo: "OTRO" };

const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const id = (v: unknown): string | null => (typeof v === "number" && Number.isFinite(v) ? String(v) : typeof v === "string" && /^-?\d{1,20}$/.test(v) ? v : null);

export function leerUpdate(payload: unknown): UpdateTelegram {
  const u = objeto(payload);
  if (!u) return { tipo: "OTRO" };

  const cb = objeto(u.callback_query);
  if (cb) {
    const de = objeto(cb.from);
    const mensaje = objeto(cb.message);
    const chat = objeto(mensaje?.chat);
    const callbackId = typeof cb.id === "string" && cb.id.length <= 100 ? cb.id : null;
    const deId = id(de?.id);
    const data = typeof cb.data === "string" && cb.data.length <= 64 ? cb.data : null;
    if (!callbackId || !deId || !data) return { tipo: "OTRO" };
    return { tipo: "BOTON", callbackId, chatId: id(chat?.id), deId, messageId: id(mensaje?.message_id), data };
  }

  const m = objeto(u.message);
  const chat = objeto(m?.chat);
  const texto = typeof m?.text === "string" ? m.text.trim() : "";
  const chatId = id(chat?.id);
  if (!m || !chatId) return { tipo: "OTRO" };
  const start = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?$/.exec(texto);
  if (!start) return { tipo: "OTRO" };
  const de = objeto(m.from);
  const nombre = [de?.first_name, de?.last_name].filter((x): x is string => typeof x === "string" && x.trim() !== "").join(" ").slice(0, 80) || null;
  return { tipo: "START", chatId, chatPrivado: chat?.type === "private", codigo: start[1] ?? null, nombre };
}

/** `callback_data` de "Aprobar y enviar": "ap:<id de la aprobación>". */
export const PREFIJO_APROBAR = "ap:";

export function datoDeAprobar(aprobacionId: string): string {
  return `${PREFIJO_APROBAR}${aprobacionId}`;
}

export function aprobacionDelBoton(data: string): string | null {
  if (!data.startsWith(PREFIJO_APROBAR)) return null;
  const resto = data.slice(PREFIJO_APROBAR.length);
  return /^[a-z0-9]{8,40}$/i.test(resto) ? resto : null;
}
