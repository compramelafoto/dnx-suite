/**
 * Botón "pedir ayuda" del participante.
 *
 * Abre WhatsApp con el mensaje ya escrito, contra el número de soporte que cada
 * edición configura. En medio de una maratón nadie tipea: el mensaje ya dice
 * quién es y de qué edición, para que soporte no tenga que preguntarlo.
 */

/** Largo de un número argentino sin país, sin 0 y sin 15: área + abonado. */
const LARGO_NACIONAL = 10;

/**
 * Convierte un número argentino escrito de cualquier forma al formato que
 * entiende WhatsApp (54 9 + área + abonado, sin signos).
 *
 * Devuelve `null` si no llega a un número plausible. Preferimos esconder el
 * botón antes que abrir un chat con quien no corresponde.
 */
export function normalizarWhatsappArgentino(valor: string | null | undefined): string | null {
  if (!valor) return null;
  let digitos = valor.replace(/\D/g, "");
  if (!digitos) return null;

  // Prefijo internacional argentino y el 9 de celulares: se recalculan al final.
  if (digitos.startsWith("54")) digitos = digitos.slice(2);
  if (digitos.startsWith("9")) digitos = digitos.slice(1);
  // Prefijo nacional de larga distancia.
  if (digitos.startsWith("0")) digitos = digitos.slice(1);

  if (digitos.length !== LARGO_NACIONAL) return null;
  return `549${digitos}`;
}

export type DatosDeAyuda = {
  /** Número de soporte configurado en la edición. */
  telefono: string | null | undefined;
  nombreEdicion: string;
  nombreParticipante: string;
  numeroParticipante: string | null;
};

/** Mensaje que el participante encuentra ya escrito al abrir WhatsApp. */
export function construirMensajeDeAyuda(datos: DatosDeAyuda): string {
  const quien = datos.numeroParticipante
    ? `${datos.nombreParticipante} (participante ${datos.numeroParticipante})`
    : datos.nombreParticipante;
  return `Hola, soy ${quien} de ${datos.nombreEdicion}. Necesito ayuda con:`;
}

/** Enlace completo a WhatsApp, o `null` si la edición no tiene soporte cargado. */
export function construirEnlaceDeAyuda(datos: DatosDeAyuda): string | null {
  const telefono = normalizarWhatsappArgentino(datos.telefono);
  if (!telefono) return null;
  const texto = encodeURIComponent(construirMensajeDeAyuda(datos));
  return `https://wa.me/${telefono}?text=${texto}`;
}
