import { normalizeWhatsappNumber } from "@/lib/contact/whatsapp";

/**
 * Teléfono → identificador de WhatsApp (E.164 sin "+"), o `null` si no sirve. Módulo PURO.
 *
 * Reutiliza `normalizeWhatsappNumber` (exige código de país y agrega el 9 de los móviles
 * argentinos), pero antes completa lo que la gente escribe a mano en Argentina y que esa función
 * no adivina: un número LOCAL ("341 341-9869", "0341 15 3419869") se interpreta como argentino.
 * El 0 de discado y el 15 se sacan; después se antepone `549`.
 */
export function waIdDe(raw: string | null | undefined): string | null {
  const texto = raw?.trim();
  if (!texto) return null;

  // Enlaces (wa.me/...) y números con "+" o prefijo 54 ya traen país: los resuelve la función base.
  if (/wa\.me|whatsapp\.com/i.test(texto) || texto.startsWith("+")) return normalizeWhatsappNumber(texto);
  const digitos = texto.replace(/\D/g, "");
  if (digitos.startsWith("54") && digitos.length >= 12) return normalizeWhatsappNumber(digitos);

  const local = localArgentino(digitos);
  return local ? normalizeWhatsappNumber(`549${local}`) : null;
}

/** 10 dígitos de un móvil argentino escrito sin país (área + abonado), o `null`. */
function localArgentino(digitos: string): string | null {
  let d = digitos;
  if (d.startsWith("0")) {
    d = d.slice(1);
    // "0341 15 3419869": el 15 va entre el área (2 a 4 dígitos) y el abonado.
    const con15 = d.match(/^(\d{2,4})15(\d{6,8})$/);
    if (con15 && con15[1].length + con15[2].length === 10) d = con15[1] + con15[2];
  }
  return /^\d{10}$/.test(d) && d[0] !== "0" ? d : null;
}

/**
 * Últimos 10 dígitos de un teléfono: la clave para comparar variantes argentinas (con/sin 54, 9, 0, 15).
 * El 0 de discado y el 15 de un número local se sacan antes (sin eso, "0341 15 3419869" daría
 * "1153419869"). Con menos de 10 dígitos devuelve lo que haya.
 */
export function ultimos10(valor: string | null | undefined): string {
  const digitos = (valor ?? "").replace(/\D/g, "");
  const local = digitos.startsWith("0") ? localArgentino(digitos) : null;
  const base = local ?? digitos;
  return base.length > 10 ? base.slice(-10) : base;
}
