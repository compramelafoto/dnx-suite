/**
 * Avisos a Meta de lo que pasó después de un anuncio "clic a WhatsApp" (API de conversiones para
 * mensajería). Con esto Meta aprende qué chats terminan en cotización o en venta y deja de buscar
 * sólo gente que conversa. Módulo PURO: elegir el clic y armar el cuerpo del aviso.
 *
 * Doc de Meta: Conversions API for Business Messaging — `action_source: "business_messaging"`,
 * `messaging_channel: "whatsapp"`, `user_data: { whatsapp_business_account_id, ctwa_clid }`.
 */

import { anuncioDeMedia } from "./anuncio";

export type EventoConversion = "LeadSubmitted" | "Purchase";

/** Meta sólo atribuye clics recientes: más allá de esto el aviso no suma. */
export const VENTANA_CLIC_MS = 90 * 24 * 3_600_000;

/** El clic de anuncio más reciente de un cliente (mensajes entrantes), dentro de la ventana. */
export function clicMasReciente(
  mensajes: readonly { media: unknown; createdAt: Date }[],
  ahora: Date,
): { ctwaClid: string; en: Date } | null {
  let mejor: { ctwaClid: string; en: Date } | null = null;
  for (const m of mensajes) {
    const clid = anuncioDeMedia(m.media)?.ctwaClid;
    if (!clid) continue;
    if (ahora.getTime() - m.createdAt.getTime() > VENTANA_CLIC_MS) continue;
    if (!mejor || m.createdAt > mejor.en) mejor = { ctwaClid: clid, en: m.createdAt };
  }
  return mejor;
}

export type DatosAviso = {
  evento: EventoConversion;
  /** Identificador estable: Meta descarta los repetidos con el mismo `event_id`. */
  eventoId: string;
  cuando: Date;
  wabaId: string;
  ctwaClid: string;
  /** En pesos (sólo para Purchase). */
  valorArs?: number | null;
};

export function cuerpoDelAviso(d: DatosAviso): { data: Record<string, unknown>[] } {
  const custom: Record<string, unknown> = {};
  if (d.evento === "Purchase" && typeof d.valorArs === "number" && Number.isFinite(d.valorArs) && d.valorArs > 0) {
    custom.currency = "ARS";
    custom.value = Math.round(d.valorArs * 100) / 100;
  }
  return {
    data: [
      {
        event_name: d.evento,
        event_time: Math.floor(d.cuando.getTime() / 1000),
        event_id: d.eventoId,
        action_source: "business_messaging",
        messaging_channel: "whatsapp",
        user_data: { whatsapp_business_account_id: d.wabaId, ctwa_clid: d.ctwaClid },
        ...(Object.keys(custom).length > 0 ? { custom_data: custom } : {}),
      },
    ],
  };
}
