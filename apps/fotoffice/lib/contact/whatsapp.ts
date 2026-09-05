/**
 * Enlaces de WhatsApp a partir del campo de contacto de la institución.
 *
 * El campo `whatsapp` del branding es texto libre y viene usándose de dos maneras: como
 * número escrito a mano y como URL puesta directamente en un `href`. Las dos tienen que
 * seguir funcionando, así que acá se acepta cualquiera de las dos y se emite una sola forma
 * canónica.
 *
 * Módulo PURO: lo importan componentes de servidor y de cliente.
 */

/** Mínimo razonable para un número con código de país; el máximo lo fija el E.164. */
const MIN_DIGITS = 11;
const MAX_DIGITS = 15;

/**
 * Deja solo los dígitos de un número utilizable, o `null`.
 *
 * Exige código de país. Un `3416811201` suelto NO se completa con `54`: adivinar el país
 * mandaría al socio a un número de otra persona. Cuando no alcanza, la pantalla ofrece el
 * email en lugar de un botón que no lleva a ninguna parte.
 */
export function normalizeWhatsappNumber(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;

  // De un enlace interesa el número, no el resto: `?text=` puede traer dígitos propios y
  // concatenarlos daría un destino inventado.
  let candidate = value;
  const link = value.match(/(?:wa\.me|api\.whatsapp\.com\/send)\/?\??(?:phone=)?(\+?[\d\s().-]+)/i);
  if (link?.[1]) candidate = link[1];

  const digits = candidate.replace(/\D/g, "");
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
  return digits;
}

/**
 * Enlace listo para abrir el chat, con el mensaje ya escrito.
 *
 * `null` cuando el número no sirve: quien llama decide qué mostrar en su lugar.
 */
export function buildWhatsappUrl(
  raw: string | null | undefined,
  message?: string,
): string | null {
  const number = normalizeWhatsappNumber(raw);
  if (!number) return null;

  const text = message?.trim();
  if (!text) return `https://wa.me/${number}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
