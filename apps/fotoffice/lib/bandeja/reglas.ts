/**
 * Reglas de la Bandeja de WhatsApp: quién atiende un chat y cómo cambia con cada hecho
 * (§3 del diseño `2026-10-09-bandeja-whatsapp-design.md`). Módulo PURO: sin base ni servidor,
 * lo usan el registro, las acciones, la pantalla y las pruebas. Cada función recibe el estado del
 * chat y devuelve el PARCHE a escribir y, si corresponde, el mensaje SISTEMA a dejar en la
 * conversación (así las acciones quedan con autor y hora).
 */

import type { EstadoDelChat } from "./constantes";

/** Lo mínimo del chat que las reglas necesitan. */
export type EstadoChat = {
  estado: EstadoDelChat;
  asignadoUserId: number | null;
  botPausadoHasta: Date | null;
  ultimoEntranteEn: Date | null;
};

export type ParcheChat = Partial<EstadoChat>;

export type ResultadoRegla = {
  parche: ParcheChat;
  /** Mensaje de sistema a registrar en el chat; ausente si no hay nada que contar. */
  sistema?: { texto: string };
};

export const VENTANA_HORAS = 24;
const HORA_MS = 3_600_000;

/**
 * §3 "atiendeElBot": true si `estado === BOT`, o si `estado === HUMANO`, sin asignado y con la
 * pausa REGISTRADA y vencida. Un chat TOMADO por alguien nunca vuelve solo al bot. Un HUMANO sin
 * asignado y sin pausa registrada es un dato incompleto: ante la duda NO contesta el bot (a falla,
 * callar es más seguro que pisar a una persona).
 */
export function atiendeElBot(chat: EstadoChat, ahora: Date): boolean {
  if (chat.estado === "BOT") return true;
  if (chat.estado !== "HUMANO") return false;
  if (chat.asignadoUserId !== null) return false;
  if (!chat.botPausadoHasta) return false;
  return chat.botPausadoHasta.getTime() <= ahora.getTime();
}

/**
 * §3 "Ventana de 24 h": se puede mandar texto libre sólo si el último mensaje del cliente es de
 * hace menos de 24 h. Fuera de la ventana el panel avisa (plantillas de Meta: etapa posterior).
 */
export function puedeResponderLibre(chat: Pick<EstadoChat, "ultimoEntranteEn">, ahora: Date): boolean {
  if (!chat.ultimoEntranteEn) return false;
  return ahora.getTime() - chat.ultimoEntranteEn.getTime() < VENTANA_HORAS * HORA_MS;
}

/**
 * §3 "Un mensaje entrante a un chat RESUELTO lo reabre en BOT (o HUMANO si tenía asignado)".
 * Siempre marca la hora del entrante (base de la ventana de 24 h). Sumar `noLeidos` y mover
 * `ultimoMensajeEn` lo hace quien registra, no las reglas.
 */
export function alEntrante(chat: EstadoChat, ahora: Date): ResultadoRegla {
  const parche: ParcheChat = { ultimoEntranteEn: ahora };
  if (chat.estado !== "RESUELTO") return { parche };
  parche.estado = chat.asignadoUserId !== null ? "HUMANO" : "BOT";
  return { parche, sistema: { texto: "Se reabrió con un mensaje nuevo" } };
}

/** "#bot" solo, o seguido de un espacio y más texto (no "#botella"). */
const COMANDO_BOT = /^#bot(\s|$)/i;

/**
 * §3 "Respuesta desde el celular (eco)": `HUMANO` y `botPausadoHasta = ahora + pausaBotHoras`, sin
 * cambiar el asignado. Si el texto empieza con "#bot": vuelve a `BOT`, sin pausa ni asignado, y se
 * registra el SISTEMA "Devuelto al bot desde el celular".
 */
export function alEco(chat: EstadoChat, ahora: Date, texto: string | null | undefined, pausaBotHoras: number): ResultadoRegla {
  if (texto && COMANDO_BOT.test(texto.trim())) {
    return {
      parche: { estado: "BOT", botPausadoHasta: null, asignadoUserId: null },
      sistema: { texto: "Devuelto al bot desde el celular" },
    };
  }
  const parche: ParcheChat = { estado: "HUMANO", botPausadoHasta: new Date(ahora.getTime() + pausaBotHoras * HORA_MS) };
  // Una persona escribió desde el celular en un chat cerrado: se reabre (queda constancia).
  if (chat.estado === "RESUELTO") return { parche, sistema: { texto: "Se reabrió desde el celular" } };
  return { parche };
}

/** §3 "Tomar (panel)": `HUMANO`, asignado a quien toma, sin pausa. `nombre` es la etiqueta del usuario. */
export function alTomar(_chat: EstadoChat, userId: number, nombre: string): ResultadoRegla {
  return {
    parche: { estado: "HUMANO", asignadoUserId: userId, botPausadoHasta: null },
    sistema: { texto: `${nombre} tomó el chat` },
  };
}

/** §3 "Devolver al bot": `BOT`, sin asignado (y sin pausa pendiente). */
export function alDevolver(_userId: number, nombre: string): ResultadoRegla {
  return {
    parche: { estado: "BOT", asignadoUserId: null, botPausadoHasta: null },
    sistema: { texto: `${nombre} devolvió el chat al bot` },
  };
}

/** §3 "Resolver": `RESUELTO`. */
export function alResolver(_userId: number, nombre: string): ResultadoRegla {
  return { parche: { estado: "RESUELTO" }, sistema: { texto: `${nombre} marcó el chat como resuelto` } };
}

/**
 * §3 "Responder desde el panel sin haber tomado el chat lo toma automáticamente". Si el chat ya
 * es de quien responde, no cambia nada.
 */
export function alResponderDesdePanel(chat: EstadoChat, userId: number, nombre: string): ResultadoRegla {
  if (chat.estado === "HUMANO" && chat.asignadoUserId === userId) return { parche: {} };
  return alTomar(chat, userId, nombre);
}

/** Minutos tras los que un mensaje que sigue PENDIENTE se muestra como INCIERTO. */
export const MINUTOS_PENDIENTE_INCIERTO = 2;

/**
 * Estado que la pantalla muestra de un mensaje saliente: un PENDIENTE de hace más de 2 minutos
 * quedó sin confirmar (el envío pudo salir o no) y se muestra "INCIERTO". El resto, tal cual.
 */
export function estadoVisible(mensaje: { estadoEnvio: string; createdAt: Date }, ahora: Date): string {
  if (mensaje.estadoEnvio !== "PENDIENTE") return mensaje.estadoEnvio;
  return ahora.getTime() - mensaje.createdAt.getTime() > MINUTOS_PENDIENTE_INCIERTO * 60_000 ? "INCIERTO" : "PENDIENTE";
}
