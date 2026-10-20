/**
 * Vista previa del último mensaje de un chat, guardada en el propio chat (`ultimoMensajeTexto` y
 * `ultimoMensajeTipo`) para que la lista no consulte los mensajes. Módulo PURO. Los mensajes
 * SISTEMA no la cambian.
 */
export const LARGO_VISTA_PREVIA = 120;

const TEXTO_POR_TIPO: Record<string, string> = {
  IMAGEN: "Imagen",
  AUDIO: "Audio",
  DOCUMENTO: "Documento",
  VIDEO: "Video",
  UBICACION: "Ubicación",
  PLANTILLA: "Plantilla",
  OTRO: "Mensaje",
};

/** Divide en unidades que se ven como un carácter (emoji compuestos incluidos) o, sin Segmenter, en puntos de código. */
function unidades(t: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: "grapheme" }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(t), (x) => x.segment);
  return Array.from(t);
}

/**
 * Recorta a `max` caracteres visibles SIN partir pares sustitutos ni secuencias de emoji (un
 * surrogate suelto hace fallar el INSERT en Postgres). Si recorta, el último lugar es "…". Con
 * `puntos: false` corta sin agregar nada (para nombres y búsquedas).
 */
export function truncarSeguro(texto: string, max: number, puntos = true): string {
  const u = unidades(texto);
  if (u.length <= max) return texto;
  return puntos ? `${u.slice(0, max - 1).join("")}…` : u.slice(0, max).join("");
}

/** Los campos a escribir en el chat: texto plano de hasta 120 caracteres (o null si no hay) y el tipo. */
export function vistaPreviaDe(texto: string | null | undefined, tipo: string | null | undefined): { ultimoMensajeTexto: string | null; ultimoMensajeTipo: string | null } {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  return {
    ultimoMensajeTexto: t ? truncarSeguro(t, LARGO_VISTA_PREVIA) : null,
    ultimoMensajeTipo: tipo ?? null,
  };
}

/** Lo que muestra la lista: el texto, o el tipo entre corchetes si no tiene; null si nunca hubo mensajes. */
export function textoDeVistaPrevia(chat: { ultimoMensajeTexto: string | null; ultimoMensajeTipo: string | null }): string | null {
  if (chat.ultimoMensajeTexto) return chat.ultimoMensajeTexto;
  if (chat.ultimoMensajeTipo) return `[${TEXTO_POR_TIPO[chat.ultimoMensajeTipo] ?? "Mensaje"}]`;
  return null;
}
