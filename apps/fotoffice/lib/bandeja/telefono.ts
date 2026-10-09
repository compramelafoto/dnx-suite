import { normalizeWhatsappNumber } from "@/lib/contact/whatsapp";

/**
 * Teléfono → identificador de WhatsApp (E.164 sin "+"), o `null` si no sirve. Módulo PURO.
 *
 * Reutiliza `normalizeWhatsappNumber` (exige código de país y agrega el 9 de los móviles
 * argentinos), pero antes completa lo que la gente escribe a mano en Argentina y que esa función
 * no adivina: un número LOCAL ("341 341-9869", "0341 15 3419869", "341 15 3419869") se interpreta
 * como argentino, y un número con país 54 pero con el 15 de los celulares ("+54 341 15 3419869")
 * se limpia. El 0 de discado y el 15 se sacan; después se antepone `549`.
 */
export function waIdDe(raw: string | null | undefined): string | null {
  const texto = raw?.trim();
  if (!texto) return null;

  // Enlaces (wa.me/...) ya traen el número armado: los resuelve la función base.
  if (/wa\.me|whatsapp\.com/i.test(texto)) return normalizeWhatsappNumber(texto);
  const digitos = texto.replace(/\D/g, "");

  if (digitos.startsWith("54")) {
    const movil = movilConPais(digitos);
    if (movil) return `549${movil}`;
  }
  if (texto.startsWith("+")) return normalizeWhatsappNumber(texto);
  if (digitos.startsWith("54") && digitos.length >= 12) return normalizeWhatsappNumber(digitos);

  const local = localArgentino(digitos);
  return local ? normalizeWhatsappNumber(`549${local}`) : null;
}

/**
 * 10 dígitos (área + abonado) de un móvil argentino escrito sin país, o `null`. Acepta el 0 de
 * discado y el 15 entre el área (2 a 4 dígitos) y el abonado, con o sin el 0.
 */
function localArgentino(digitos: string): string | null {
  const d = digitos.startsWith("0") ? digitos.slice(1) : digitos;
  if (d.startsWith("0")) return null;
  if (/^\d{10}$/.test(d)) return d;
  const con15 = d.match(/^(\d{2,4})15(\d{6,8})$/);
  if (con15 && con15[1].length + con15[2].length === 10) return con15[1] + con15[2];
  return null;
}

/** Lo mismo para un número que ya trae el 54 (con o sin el 9 de los móviles). */
function movilConPais(digitos: string): string | null {
  const resto = digitos.slice(2);
  if (resto.startsWith("9")) {
    const sin9 = localArgentino(resto.slice(1));
    if (sin9) return sin9;
  }
  return localArgentino(resto);
}

/**
 * Últimos 10 dígitos de un teléfono: la clave para comparar variantes argentinas (con/sin 54, 9, 0, 15).
 * El 0 de discado y el 15 se sacan antes (sin eso, "0341 15 3419869" daría "1153419869").
 * Con menos de 10 dígitos devuelve lo que haya. Sólo tiene sentido para números argentinos.
 */
export function ultimos10(valor: string | null | undefined): string {
  const digitos = (valor ?? "").replace(/\D/g, "");
  const ar = digitos.startsWith("54") ? movilConPais(digitos) : localArgentino(digitos);
  const base = ar ?? digitos;
  return base.length > 10 ? base.slice(-10) : base;
}

/**
 * ¿Es un teléfono argentino? Con 54 delante, o escrito en forma local (10 dígitos, con 0 y/o con 15).
 * Un 11 que no empieza con 0 ("1 341 341 9869") es de otro país, no un local con un dígito de más.
 */
function esArgentino(digitos: string): boolean {
  return digitos.startsWith("54") || digitos.length < 10 || localArgentino(digitos) !== null;
}

/**
 * ¿El teléfono de una ficha es el mismo que el `waId` de un chat? Si los dos son argentinos se
 * comparan por los últimos 10 dígitos (absorbe 54, 9, 0 y 15); si no, por los dígitos completos
 * (comparar sólo el final haría coincidir números de países distintos).
 */
export function mismoTelefono(waId: string, telefono: string | null | undefined): boolean {
  const a = waId.replace(/\D/g, "");
  const b = (telefono ?? "").replace(/\D/g, "");
  if (!a || !b) return false;
  if (esArgentino(a) && esArgentino(b)) {
    const x = ultimos10(a);
    return x.length === 10 && x === ultimos10(b);
  }
  return a === b;
}
