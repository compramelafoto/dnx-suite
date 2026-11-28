import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Adaptado de apps/fotoffice/lib/bandeja/webhook.ts (copia mínima, sin importar entre apps).
 * Sólo lee mensajes de texto entrantes: es lo único que necesita la verificación del teléfono.
 */

export type MensajeTexto = { waId: string; texto: string };

type Json = Record<string, unknown>;
const esObjeto = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Mensajes de texto de un webhook de Meta. Nunca lanza: lo ilegible se ignora. */
export function leerWebhook(json: unknown): MensajeTexto[] {
  const salida: MensajeTexto[] = [];
  try {
    if (!esObjeto(json)) return salida;
    for (const entry of lista(json.entry)) {
      if (!esObjeto(entry)) continue;
      for (const change of lista(entry.changes)) {
        if (!esObjeto(change) || change.field !== "messages" || !esObjeto(change.value)) continue;
        for (const m of lista(change.value.messages)) {
          if (!esObjeto(m) || m.type !== "text" || !esObjeto(m.text)) continue;
          const from = typeof m.from === "string" ? m.from.replace(/\D/g, "") : "";
          const body = typeof m.text.body === "string" ? m.text.body : "";
          if (from && body) salida.push({ waId: from, texto: body });
        }
      }
    }
  } catch {
    // Tolerante a propósito: devuelve lo que alcanzó a leer.
  }
  return salida;
}

/** Igualdad de textos en tiempo constante (con guarda de largo). */
export function mismoTextoSeguro(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Firma de Meta: `x-hub-signature-256: sha256=<HMAC-SHA256 hex del cuerpo crudo>`. */
export function firmaValida(
  cuerpo: string | Uint8Array,
  firma: string | null | undefined,
  secreto: string,
): boolean {
  if (!firma || !secreto) return false;
  const esperada = Buffer.from(`sha256=${createHmac("sha256", secreto).update(cuerpo).digest("hex")}`);
  const recibida = Buffer.from(firma.trim());
  if (esperada.length !== recibida.length) return false;
  return timingSafeEqual(esperada, recibida);
}
