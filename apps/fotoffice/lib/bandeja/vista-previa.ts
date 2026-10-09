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

/** Los campos a escribir en el chat: texto plano de hasta 120 caracteres (o null si no hay) y el tipo. */
export function vistaPreviaDe(texto: string | null | undefined, tipo: string | null | undefined): { ultimoMensajeTexto: string | null; ultimoMensajeTipo: string | null } {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  return {
    ultimoMensajeTexto: t ? (t.length > LARGO_VISTA_PREVIA ? `${t.slice(0, LARGO_VISTA_PREVIA - 1)}…` : t) : null,
    ultimoMensajeTipo: tipo ?? null,
  };
}

/** Lo que muestra la lista: el texto, o el tipo entre corchetes si no tiene; null si nunca hubo mensajes. */
export function textoDeVistaPrevia(chat: { ultimoMensajeTexto: string | null; ultimoMensajeTipo: string | null }): string | null {
  if (chat.ultimoMensajeTexto) return chat.ultimoMensajeTexto;
  if (chat.ultimoMensajeTipo) return `[${TEXTO_POR_TIPO[chat.ultimoMensajeTipo] ?? "Mensaje"}]`;
  return null;
}
