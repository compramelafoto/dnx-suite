import { puedeResponderLibre } from "./reglas";

/**
 * A dónde lleva el botón «Enviar WhatsApp» de una ficha. Módulo PURO.
 *
 * - Hay un chat en la Bandeja y el cliente escribió hace menos de 24 h → la Bandeja: se le puede
 *   responder con texto libre desde el panel y la conversación queda registrada.
 * - Hay chat, pasaron las 24 h y el workspace tiene plantillas aprobadas por Meta → la Bandeja
 *   también: fuera de la ventana se le escribe con una plantilla.
 * - En cualquier otro caso (sin chat, sin permiso, sin plantillas) → WhatsApp Web (`wa.me`).
 */
export type DestinoWhatsapp = { tipo: "bandeja" | "web"; href: string };

export type ChatParaDestino = { id: string; ultimoEntranteEn: Date | null };

export function elegirDestinoWhatsapp(entrada: {
  waId: string;
  chat: ChatParaDestino | null;
  puedeUsarBandeja: boolean;
  hayPlantillas: boolean;
  ahora: Date;
}): DestinoWhatsapp {
  const web: DestinoWhatsapp = { tipo: "web", href: `https://wa.me/${entrada.waId}` };
  const { chat } = entrada;
  if (!chat || !entrada.puedeUsarBandeja) return web;
  if (puedeResponderLibre(chat, entrada.ahora) || entrada.hayPlantillas) {
    return { tipo: "bandeja", href: `/bandeja/${encodeURIComponent(chat.id)}` };
  }
  return web;
}

/** ¿Hace falta preguntarle a Meta por las plantillas? Sólo con chat y fuera de la ventana. */
export function necesitaPlantillas(chat: ChatParaDestino | null, puedeUsarBandeja: boolean, ahora: Date): boolean {
  return Boolean(chat && puedeUsarBandeja && !puedeResponderLibre(chat, ahora));
}
