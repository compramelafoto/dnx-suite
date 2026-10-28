/**
 * Mensajes de un chat de la Bandeja → lo que ve el modelo. Módulo PURO.
 *
 * El chat ES la conversación (no hay `BotConversation`): lo del cliente va como `user` y todo lo
 * nuestro (bot, una persona del equipo, el celular) como `assistant`, para que el bot sepa qué ya
 * se le dijo. Los mensajes del sistema (tomas, devoluciones) no son parte de la charla.
 */

import { archivoDeMensaje } from "../archivo-de-mensaje";
import { medidasQueAlcanzan } from "../calidad";

export type MensajeChat = { id?: string; direccion: string; autor: string; tipo: string; texto: string | null; media?: unknown; createdAt?: Date };
export type MensajeModelo = { role: "user" | "assistant"; content: string };
/** Una foto numerada del chat: su mensaje y cuándo llegó. */
export type FotoNumerada = { id: string; en: Date | null };

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

/** Más de esto sin mensajes y la charla empieza de nuevo (el bot no arrastra lo de otro día). */
const PAUSA_CHARLA_NUEVA_MS = 24 * 3_600_000;

/**
 * Sólo la charla actual: lo posterior al último "marcó el chat como resuelto" y a la última pausa
 * de más de 24 h. Así el bot no arrastra datos de pedidos o consultas viejas.
 */
export function charlaActual(mensajes: readonly MensajeChat[]): readonly MensajeChat[] {
  let desde = 0;
  for (let i = 0; i < mensajes.length; i++) {
    const m = mensajes[i];
    if ((m.direccion === "SISTEMA" || m.autor === "SISTEMA") && /como resuelto/i.test(m.texto ?? "")) desde = i + 1;
    const previo = i > 0 ? mensajes[i - 1].createdAt : undefined;
    if (previo && m.createdAt && m.createdAt.getTime() - previo.getTime() > PAUSA_CHARLA_NUEVA_MS) desde = Math.max(desde, i);
  }
  return mensajes.slice(desde);
}

/**
 * `userText`: el bloque final del cliente (lo que hay que responder). `history`: lo anterior, que
 * siempre empieza con el cliente y alterna. `null` si lo último no es del cliente.
 */
export function historialParaElBot(
  mensajes: readonly MensajeChat[],
  max = 40,
  ahora?: Date,
): { history: MensajeModelo[]; userText: string; fotos: Map<number, FotoNumerada>; fotosBajando: number } | null {
  mensajes = charlaActual(mensajes);
  const bloques: MensajeModelo[] = [];
  // Las fotos que se pueden imprimir se numeran ("foto 1", "foto 2"…) para que el bot arme el pedido.
  const fotos = new Map<number, FotoNumerada>();
  let fotosBajando = 0;
  for (const m of mensajes) {
    if (m.direccion === "SISTEMA" || m.autor === "SISTEMA") continue;
    const role = m.direccion === "ENTRANTE" ? "user" : "assistant";
    let contenido = role === "user" ? textoDe(m, ahora) : m.texto?.trim();
    const a = role === "user" && m.id ? archivoDeMensaje(m.tipo, m.media) : null;
    const esFoto = a !== null && (m.tipo === "IMAGEN" || (a.mime?.startsWith("image/") ?? false));
    if (esFoto && a!.estado === "LISTO") {
      const n = fotos.size + 1;
      fotos.set(n, { id: m.id!, en: m.createdAt ?? null });
      contenido = `[foto ${n}] ${contenido}`;
    } else if (esFoto && a!.estado === "PENDIENTE") {
      fotosBajando++;
    }
    if (!contenido) continue;
    const ultimo = bloques.at(-1);
    if (ultimo && ultimo.role === role) ultimo.content += `\n${contenido}`;
    else bloques.push({ role, content: contenido });
  }
  const final = bloques.pop();
  if (!final || final.role !== "user") return null;

  let history = bloques.slice(-max);
  while (history.length > 0 && history[0].role !== "user") history = history.slice(1);
  return { history, userText: final.content, fotos, fotosBajando };
}
