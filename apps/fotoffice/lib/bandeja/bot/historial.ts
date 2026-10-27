/**
 * Mensajes de un chat de la Bandeja → lo que ve el modelo. Módulo PURO.
 *
 * El chat ES la conversación (no hay `BotConversation`): lo del cliente va como `user` y todo lo
 * nuestro (bot, una persona del equipo, el celular) como `assistant`, para que el bot sepa qué ya
 * se le dijo. Los mensajes del sistema (tomas, devoluciones) no son parte de la charla.
 */

import { archivoDeMensaje } from "../archivo-de-mensaje";
import { medidasQueAlcanzan } from "../calidad";

export type MensajeChat = { direccion: string; autor: string; tipo: string; texto: string | null; media?: unknown; createdAt?: Date };
export type MensajeModelo = { role: "user" | "assistant"; content: string };

const SIN_TEXTO: Record<string, string> = {
  IMAGEN: "[el cliente mandó una foto]",
  AUDIO: "[el cliente mandó un audio]",
  DOCUMENTO: "[el cliente mandó un archivo]",
  VIDEO: "[el cliente mandó un video]",
  UBICACION: "[el cliente mandó una ubicación]",
};

/** Lo que ya se sabe del archivo bajado (etapa 2): resolución de las fotos, o que no se pudo guardar. */
function etiquetaDeArchivo(m: MensajeChat, ahora: Date | undefined): string | null {
  const a = archivoDeMensaje(m.tipo, m.media, ahora && m.createdAt ? { direccion: m.direccion, createdAt: m.createdAt, ahora } : undefined);
  if (!a) return null;
  if (a.estado === "GRANDE") return "[el cliente mandó un archivo de más de 100 MB que no se pudo guardar]";
  const esFoto = m.tipo === "IMAGEN" || (a.mime?.startsWith("image/") ?? false);
  if (a.estado === "FALLO") return esFoto ? "[el cliente mandó una foto pero no se pudo bajar: pedile que la reenvíe]" : "[el cliente mandó un archivo pero no se pudo bajar: pedile que lo reenvíe]";
  if (a.estado !== "LISTO" || !esFoto || !a.ancho || !a.alto) return null;
  const que = m.tipo === "IMAGEN" ? "una foto" : "la foto original (como documento)";
  const medidas = medidasQueAlcanzan(a.ancho, a.alto);
  const alcance = medidas.length > 0 ? `alcanza para imprimir hasta: ${medidas.join(", ")}` : "no alcanza para imprimir";
  return `[el cliente mandó ${que} de ${a.ancho}×${a.alto} px; ${alcance}]`;
}

function textoDe(m: MensajeChat, ahora?: Date): string {
  const t = m.texto?.trim() ?? "";
  if (m.tipo === "TEXTO") return t;
  const adjunto = etiquetaDeArchivo(m, ahora) ?? SIN_TEXTO[m.tipo] ?? "[el cliente mandó algo que no es texto]";
  return t ? `${adjunto} ${t}` : adjunto;
}

/**
 * `userText`: el bloque final del cliente (lo que hay que responder). `history`: lo anterior, que
 * siempre empieza con el cliente y alterna. `null` si lo último no es del cliente.
 */
export function historialParaElBot(mensajes: readonly MensajeChat[], max = 40, ahora?: Date): { history: MensajeModelo[]; userText: string } | null {
  const bloques: MensajeModelo[] = [];
  for (const m of mensajes) {
    if (m.direccion === "SISTEMA" || m.autor === "SISTEMA") continue;
    const role = m.direccion === "ENTRANTE" ? "user" : "assistant";
    const contenido = role === "user" ? textoDe(m, ahora) : m.texto?.trim();
    if (!contenido) continue;
    const ultimo = bloques.at(-1);
    if (ultimo && ultimo.role === role) ultimo.content += `\n${contenido}`;
    else bloques.push({ role, content: contenido });
  }
  const final = bloques.pop();
  if (!final || final.role !== "user") return null;

  let history = bloques.slice(-max);
  while (history.length > 0 && history[0].role !== "user") history = history.slice(1);
  return { history, userText: final.content };
}
