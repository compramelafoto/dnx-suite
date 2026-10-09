import { createHmac, timingSafeEqual } from "node:crypto";
import type { TipoMensaje } from "./constantes";
import { waIdDe } from "./telefono";

/**
 * Entrada de la Bandeja de WhatsApp: del JSON de Meta (WhatsApp Cloud API) a una lista de eventos
 * simples (§5 del diseño). Módulo PURO, sin base. El parser es TOLERANTE: ignora lo que no
 * entiende y nunca lanza (el formato del eco `smb_message_echoes` falta confirmarlo con un payload real).
 */

export type MediaWa = {
  id?: string;
  mimeType?: string;
  caption?: string;
  filename?: string;
  latitude?: number;
  longitude?: number;
  nombre?: string;
  direccion?: string;
};

type Comun = {
  /** Identifica la conexión (y por ella el workspace). */
  phoneNumberId: string;
  /** Mensaje de WhatsApp: clave de idempotencia. */
  waMessageId: string;
  /** Hora que informa Meta; `null` si vino ilegible (quien registra usa la hora de recepción). */
  en: Date | null;
};

type ConContenido = {
  waId: string;
  mensajeTipo: TipoMensaje;
  texto: string | null;
  media: MediaWa | null;
};

export type EventoEntrante = Comun & ConContenido & { tipo: "ENTRANTE"; nombre: string | null };
export type EventoEco = Comun & ConContenido & { tipo: "ECO" };
export type EstadoDeEnvioWa = "ENVIADO" | "ENTREGADO" | "LEIDO" | "FALLO";
export type EventoEstado = Comun & { tipo: "ESTADO"; estado: EstadoDeEnvioWa; errorCodigo: string | null };
export type EventoWa = EventoEntrante | EventoEco | EventoEstado;

type Json = Record<string, unknown>;
const esObjeto = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texto = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : typeof v === "number" ? String(v) : null);

function fecha(v: unknown): Date | null {
  const s = texto(v);
  if (!s || !/^\d{1,12}$/.test(s)) return null;
  return new Date(Number(s) * 1000);
}

/** Teléfono del evento → waId. Meta manda a veces el móvil argentino sin el 9: se unifica. */
function waIdDeMeta(v: unknown): string | null {
  const s = texto(v);
  if (!s) return null;
  const digitos = s.replace(/\D/g, "");
  if (digitos.length < 8) return null;
  return waIdDe(`+${digitos}`) ?? digitos;
}

const TIPOS_CON_ARCHIVO: Record<string, TipoMensaje> = { image: "IMAGEN", sticker: "IMAGEN", audio: "AUDIO", document: "DOCUMENTO", video: "VIDEO" };

/** Contenido de un mensaje (entrante o eco): tipo, texto y datos del archivo/ubicación. */
function contenido(m: Json): { mensajeTipo: TipoMensaje; texto: string | null; media: MediaWa | null } {
  const tipo = texto(m.type) ?? "";
  if (tipo === "text") {
    return { mensajeTipo: "TEXTO", texto: esObjeto(m.text) ? texto(m.text.body) : null, media: null };
  }
  const conArchivo = TIPOS_CON_ARCHIVO[tipo];
  if (conArchivo) {
    const o = esObjeto(m[tipo]) ? m[tipo] : {};
    const media: MediaWa = {};
    const id = texto(o.id);
    const mime = texto(o.mime_type);
    const filename = texto(o.filename);
    const caption = texto(o.caption);
    if (id) media.id = id;
    if (mime) media.mimeType = mime;
    if (filename) media.filename = filename;
    if (caption) media.caption = caption;
    return { mensajeTipo: conArchivo, texto: caption, media };
  }
  if (tipo === "location") {
    const o = esObjeto(m.location) ? m.location : {};
    const media: MediaWa = {};
    if (typeof o.latitude === "number") media.latitude = o.latitude;
    if (typeof o.longitude === "number") media.longitude = o.longitude;
    const nombre = texto(o.name);
    const direccion = texto(o.address);
    if (nombre) media.nombre = nombre;
    if (direccion) media.direccion = direccion;
    return { mensajeTipo: "UBICACION", texto: nombre ?? direccion, media };
  }
  return { mensajeTipo: "OTRO", texto: null, media: null };
}

function mensajes(value: Json, phoneNumberId: string, salida: EventoWa[]) {
  const perfiles = new Map<string, string>();
  for (const c of lista(value.contacts)) {
    if (!esObjeto(c)) continue;
    const wa = waIdDeMeta(c.wa_id);
    const nombre = esObjeto(c.profile) ? texto(c.profile.name) : null;
    if (wa && nombre) perfiles.set(wa, nombre);
  }
  for (const m of lista(value.messages)) {
    if (!esObjeto(m)) continue;
    // Una reacción no es un mensaje: no suma no leídos ni mueve la ventana de 24 horas.
    if (m.type === "reaction") continue;
    const waMessageId = texto(m.id);
    const waId = waIdDeMeta(m.from);
    if (!waMessageId || !waId) continue;
    salida.push({
      tipo: "ENTRANTE", phoneNumberId, waMessageId, waId, en: fecha(m.timestamp),
      nombre: perfiles.get(waId) ?? null, ...contenido(m),
    });
  }
  for (const s of lista(value.statuses)) {
    if (!esObjeto(s)) continue;
    const waMessageId = texto(s.id);
    const estado = ESTADOS[texto(s.status) ?? ""];
    if (!waMessageId || !estado) continue;
    const primero = lista(s.errors).find(esObjeto);
    salida.push({
      tipo: "ESTADO", phoneNumberId, waMessageId, en: fecha(s.timestamp), estado,
      errorCodigo: primero ? texto(primero.code) : null,
    });
  }
}

const ESTADOS: Record<string, EstadoDeEnvioWa> = { sent: "ENVIADO", delivered: "ENTREGADO", read: "LEIDO", failed: "FALLO" };

function ecos(value: Json, phoneNumberId: string, salida: EventoWa[]) {
  for (const m of lista(value.message_echoes)) {
    if (!esObjeto(m) || m.type === "reaction") continue;
    const waMessageId = texto(m.id);
    const waId = waIdDeMeta(m.to);
    if (!waMessageId || !waId) continue;
    salida.push({ tipo: "ECO", phoneNumberId, waMessageId, waId, en: fecha(m.timestamp), ...contenido(m) });
  }
}

/** Lista de eventos de un webhook de Meta. Nunca lanza: lo ilegible se ignora. */
export function leerWebhook(json: unknown): EventoWa[] {
  const salida: EventoWa[] = [];
  try {
    if (!esObjeto(json)) return salida;
    for (const entry of lista(json.entry)) {
      if (!esObjeto(entry)) continue;
      for (const change of lista(entry.changes)) {
        if (!esObjeto(change) || !esObjeto(change.value)) continue;
        const value = change.value;
        const phoneNumberId = esObjeto(value.metadata) ? texto(value.metadata.phone_number_id) : null;
        if (!phoneNumberId) continue;
        if (change.field === "messages") mensajes(value, phoneNumberId, salida);
        else if (change.field === "smb_message_echoes") ecos(value, phoneNumberId, salida);
      }
    }
  } catch {
    // Tolerante a propósito: devuelve lo que alcanzó a leer.
  }
  return salida;
}

/** Igualdad de textos en tiempo constante (con guarda de largo: `timingSafeEqual` lo exige). */
export function mismoTextoSeguro(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Firma de Meta: `x-hub-signature-256: sha256=<HMAC-SHA256 hex del cuerpo crudo con el app secret>`.
 * Comparación en tiempo constante.
 */
export function firmaValida(cuerpo: string | Uint8Array, firma: string | null | undefined, secreto: string): boolean {
  if (!firma || !secreto) return false;
  const esperada = Buffer.from(`sha256=${createHmac("sha256", secreto).update(cuerpo).digest("hex")}`);
  const recibida = Buffer.from(firma.trim());
  if (esperada.length !== recibida.length) return false;
  return timingSafeEqual(esperada, recibida);
}
