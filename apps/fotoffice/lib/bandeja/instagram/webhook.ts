import { anuncioDeReferral } from "../anuncio";
import type { TipoMensaje } from "../constantes";
import type { EventoWa, MediaWa } from "../webhook";

/**
 * Entrada de la Bandeja desde Instagram (Messenger Platform for Instagram): del JSON de Meta a los
 * mismos eventos que WhatsApp, para que los registre `aplicarEventos`. Módulo PURO, sin base.
 * Tolerante: ignora lo que no entiende y nunca lanza. No guarda ni loguea textos ni IGSID.
 */

type Json = Record<string, unknown>;
const esObjeto = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texto = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : typeof v === "number" ? String(v) : null);

/** A diferencia de WhatsApp, `timestamp` viene en MILISEGUNDOS. */
function fecha(v: unknown): Date | null {
  const s = texto(v);
  if (!s || !/^\d{1,15}$/.test(s)) return null;
  return new Date(Number(s));
}

const TIPOS: Record<string, TipoMensaje> = { image: "IMAGEN", audio: "AUDIO", video: "VIDEO", file: "DOCUMENTO" };

/** Un adjunto → tipo y dirección del archivo. */
function adjunto(a: unknown): { mensajeTipo: TipoMensaje; url: string | null; tipo: string } {
  const o = esObjeto(a) ? a : {};
  const tipo = texto(o.type) ?? "";
  const url = esObjeto(o.payload) ? texto(o.payload.url) : null;
  return { mensajeTipo: TIPOS[tipo] ?? "OTRO", url, tipo };
}

/** Lista de eventos de un webhook de Instagram. Nunca lanza: lo ilegible se ignora. */
export function leerWebhookInstagram(json: unknown): EventoWa[] {
  const salida: EventoWa[] = [];
  try {
    if (!esObjeto(json)) return salida;
    for (const entry of lista(json.entry)) {
      if (!esObjeto(entry)) continue;
      for (const item of lista(entry.messaging)) {
        try {
          evento(item, texto(entry.id), salida);
        } catch {
          // Un ítem roto no tira los demás.
        }
      }
    }
  } catch {
    // Tolerante a propósito: devuelve lo que alcanzó a leer.
  }
  return salida;
}

function evento(item: unknown, cuentaDeEntry: string | null, salida: EventoWa[]) {
  // Reacciones, vistos, postbacks y referrals sueltos no traen `message`: no son mensajes.
  if (!esObjeto(item) || !esObjeto(item.message)) return;
  const m = item.message;
  // Mensaje borrado por el cliente: no hay nada que mostrar.
  if (m.is_deleted === true) return;
  const mid = texto(m.mid);
  if (!mid) return;
  const remitente = esObjeto(item.sender) ? texto(item.sender.id) : null;
  const destinatario = esObjeto(item.recipient) ? texto(item.recipient.id) : null;
  const eco = m.is_echo === true;
  const waId = eco ? destinatario : remitente;
  const phoneNumberId = cuentaDeEntry ?? (eco ? remitente : destinatario);
  if (!waId || !phoneNumberId) return;
  const en = fecha(item.timestamp);

  let cuerpo = texto(m.text);
  const enHistoria = esObjeto(m.reply_to) && esObjeto(m.reply_to.story);
  if (enHistoria && cuerpo) cuerpo = `[respondió a tu historia] ${cuerpo}`;
  const anuncio = anuncioDeReferral(m.referral) ?? anuncioDeReferral(item.referral);
  const appId = eco ? texto(m.app_id) : null;
  const adjuntos = lista(m.attachments).map(adjunto);

  // Sin adjuntos: un único evento de texto (o "no soportado").
  const bloques: { mensajeTipo: TipoMensaje; texto: string | null; media: MediaWa | null }[] = [];
  if (adjuntos.length === 0) {
    bloques.push({ mensajeTipo: m.is_unsupported === true ? "OTRO" : "TEXTO", texto: m.is_unsupported === true ? null : cuerpo, media: null });
  } else {
    adjuntos.forEach((a, i) => {
      let t: string | null = i === 0 ? cuerpo : null;
      if (a.tipo === "story_mention") t = i === 0 && cuerpo ? `[te mencionó en una historia] ${cuerpo}` : "[te mencionó en una historia]";
      bloques.push({ mensajeTipo: a.mensajeTipo, texto: t, media: a.url ? { url: a.url } : null });
    });
  }

  bloques.forEach((b, i) => {
    const media: MediaWa = { ...(b.media ?? {}) };
    if (i === 0 && anuncio) media.anuncio = anuncio;
    if (appId) media.appId = appId;
    const comun = {
      canal: "INSTAGRAM" as const, phoneNumberId, waId, en,
      waMessageId: i === 0 ? mid : `${mid}:${i}`,
      mensajeTipo: b.mensajeTipo, texto: b.texto,
      media: Object.keys(media).length > 0 ? media : null,
    };
    salida.push(eco ? { tipo: "ECO", ...comun } : { tipo: "ENTRANTE", nombre: null, ...comun });
  });
}
