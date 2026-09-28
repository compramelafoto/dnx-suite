import { buildWhatsappUrl } from "@/lib/contact/whatsapp";

/**
 * Teléfonos de Alboom a formato WhatsApp.
 *
 * `lib/contact/whatsapp.ts` no adivina el país a propósito: un número suelto del padrón de una
 * institución puede ser de cualquier lado. Acá el caso es otro: el formulario de Alboom de un
 * fotógrafo argentino pide el celular sin código de país, y el 95 % llega como `341xxxxxxx`.
 * Por eso ESTE módulo sí completa con 54 9, y sólo cuando el resto tiene forma de celular
 * argentino (10 dígitos después de sacar el 0 y el 15).
 *
 * Módulo PURO.
 */
export function normalizarTelefonoArgentino(raw: string | null | undefined): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (!d) return null;

  if (d.startsWith("549") && d.length === 13) return d;
  if (d.startsWith("54") && !d.startsWith("549") && d.length === 12) return `549${d.slice(2)}`;

  // Local: sacar el 0 de larga distancia y el 15 de celular.
  if (d.startsWith("0")) d = d.slice(1);
  const con15 = d.match(/^(\d{2,4})15(\d{6,8})$/);
  if (con15 && con15[1].length + con15[2].length === 10) d = `${con15[1]}${con15[2]}`;

  if (d.length === 10) return `549${d}`;
  return null;
}

export function enlaceWhatsapp(raw: string | null | undefined, mensaje: string): string | null {
  const numero = normalizarTelefonoArgentino(raw);
  if (!numero) return null;
  return buildWhatsappUrl(`+${numero}`, mensaje);
}
