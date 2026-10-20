/**
 * Mensajes de un chat de la Bandeja → lo que ve el modelo. Módulo PURO.
 *
 * El chat ES la conversación (no hay `BotConversation`): lo del cliente va como `user` y todo lo
 * nuestro (bot, una persona del equipo, el celular) como `assistant`, para que el bot sepa qué ya
 * se le dijo. Los mensajes del sistema (tomas, devoluciones) no son parte de la charla.
 */

export type MensajeChat = { direccion: string; autor: string; tipo: string; texto: string | null };
export type MensajeModelo = { role: "user" | "assistant"; content: string };

const SIN_TEXTO: Record<string, string> = {
  IMAGEN: "[el cliente mandó una foto]",
  AUDIO: "[el cliente mandó un audio]",
  DOCUMENTO: "[el cliente mandó un archivo]",
  VIDEO: "[el cliente mandó un video]",
  UBICACION: "[el cliente mandó una ubicación]",
};

function textoDe(m: MensajeChat): string {
  const t = m.texto?.trim() ?? "";
  if (m.tipo === "TEXTO") return t;
  const adjunto = SIN_TEXTO[m.tipo] ?? "[el cliente mandó algo que no es texto]";
  return t ? `${adjunto} ${t}` : adjunto;
}

/**
 * `userText`: el bloque final del cliente (lo que hay que responder). `history`: lo anterior, que
 * siempre empieza con el cliente y alterna. `null` si lo último no es del cliente.
 */
export function historialParaElBot(mensajes: readonly MensajeChat[], max = 40): { history: MensajeModelo[]; userText: string } | null {
  const bloques: MensajeModelo[] = [];
  for (const m of mensajes) {
    if (m.direccion === "SISTEMA" || m.autor === "SISTEMA") continue;
    const role = m.direccion === "ENTRANTE" ? "user" : "assistant";
    const contenido = role === "user" ? textoDe(m) : m.texto?.trim();
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
