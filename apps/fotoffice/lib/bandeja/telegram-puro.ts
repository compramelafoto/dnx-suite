/**
 * Telegram para la Bandeja (§7 del diseño 2026-11-24): textos y botones de lo que se le manda al
 * dueño del chat de Telegram, y la lectura de sus botones. Módulo PURO. Todo texto del cliente o
 * del equipo se escapa (Telegram con `parse_mode: HTML`).
 */

import type { TecladoTelegram } from "@/lib/telegram/api";
import { textoDeEspera } from "./espera";

export const PREFIJO_BANDEJA = "bj:";

export function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const corto = (texto: string, max: number) => {
  const plano = texto.replace(/\s+/g, " ").trim();
  return plano.length > max ? `${plano.slice(0, max - 1)}…` : plano;
};

const horaArgentina = (d: Date) => d.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false });

export type UltimoMensaje = { deCliente: boolean; autor: string | null; texto: string };

export function tarjetaDeDerivacion(p: {
  quien: string | null;
  titulo: string;
  canal: "WHATSAPP" | "INSTAGRAM";
  campana: string | null;
  resumen: string | null;
  ultimos: UltimoMensaje[];
  esperaMinutos: number | null;
  ventanaHasta: Date | null;
}): string {
  const l: string[] = [];
  l.push(p.quien ? `📥 <b>${escapar(p.quien)} te derivó un chat</b>` : "📥 <b>Te asignaron un chat</b>");
  l.push([escapar(p.titulo), p.canal === "INSTAGRAM" ? "Instagram" : "WhatsApp", p.campana ? `Campaña ${escapar(p.campana)}` : null].filter(Boolean).join(" · "));
  if (p.resumen) l.push("", `Resumen: ${escapar(p.resumen)}`);
  if (p.ultimos.length > 0) {
    l.push("", "Últimos mensajes:");
    for (const m of p.ultimos) l.push(m.deCliente ? `👤 ${escapar(corto(m.texto, 300))}` : `🏢 ${m.autor ? `(${escapar(m.autor)}) ` : ""}${escapar(corto(m.texto, 300))}`);
  }
  const ventana = p.ventanaHasta ? `ventana de 24 h abierta hasta ${horaArgentina(p.ventanaHasta)}` : "ventana de 24 h cerrada: hay que usar una plantilla";
  l.push("", `⏱ ${p.esperaMinutos !== null ? `${textoDeEspera(p.esperaMinutos)} · ` : ""}${ventana}`);
  l.push("", "<i>Para responderle, citá este mensaje.</i>");
  return l.join("\n");
}

const ARCHIVO: Record<string, string> = {
  IMAGEN: "📷 {n} mandó una foto",
  AUDIO: "🎤 {n} mandó un audio",
  VIDEO: "🎬 {n} mandó un video",
  DOCUMENTO: "📎 {n} mandó un archivo",
  UBICACION: "📍 {n} mandó una ubicación",
};

/** Cada mensaje nuevo del cliente mientras el chat siga asignado al dueño del Telegram. */
export function avisoDeMensaje(titulo: string, tipo: string, texto: string | null): string {
  const n = `<b>${escapar(titulo)}</b>`;
  if (tipo === "TEXTO" || (texto && !ARCHIVO[tipo])) return `💬 ${n}: ${escapar(corto(texto ?? "", 3500))}`;
  const base = (ARCHIVO[tipo] ?? "📨 {n} mandó un mensaje").replace("{n}", n);
  return texto?.trim() ? `${base}: ${escapar(corto(texto, 1000))}` : base;
}

export function botonesDelChat(chatId: string, urlChat: string): TecladoTelegram {
  return {
    inline_keyboard: [
      [
        { text: "Derivar ▸", callback_data: `bj:dv:${chatId}` },
        { text: "Resolver", callback_data: `bj:r:${chatId}` },
      ],
      [{ text: "Abrir en FOTOFFICE", url: urlChat }],
    ],
  };
}

export function botonesDerivar(chatId: string, personas: readonly { userId: number; nombre: string }[]): TecladoTelegram {
  return {
    inline_keyboard: [
      ...personas.map((p) => [{ text: corto(p.nombre, 40), callback_data: `bj:d:${chatId}:${p.userId}` }]),
      [{ text: "🤖 Bot", callback_data: `bj:d:${chatId}:bot` }],
      [{ text: "← Volver", callback_data: `bj:bk:${chatId}` }],
    ],
  };
}

export function botonTomarYEnviar(avisoId: string): TecladoTelegram {
  return { inline_keyboard: [[{ text: "Tomarlo y enviar", callback_data: `bj:t:${avisoId}` }]] };
}

export type BotonBandeja =
  | { accion: "dv" | "bk" | "r"; chatId: string }
  | { accion: "d"; chatId: string; destino: number | "bot" }
  | { accion: "t"; avisoId: string };

const ID = "[A-Za-z0-9_-]{1,40}";
const SIMPLE = new RegExp(`^bj:(dv|bk|r):(${ID})$`);
const DERIVAR = new RegExp(`^bj:d:(${ID}):(bot|[1-9][0-9]{0,9})$`);
const TOMAR = new RegExp(`^bj:t:(${ID})$`);

/** Lee un botón de la Bandeja. Lo que no tiene la forma exacta, `null` (los ids se validan después contra el workspace). */
export function leerBotonBandeja(data: string): BotonBandeja | null {
  if (data.length > 64 || !data.startsWith(PREFIJO_BANDEJA)) return null;
  const s = SIMPLE.exec(data);
  if (s) return { accion: s[1] as "dv" | "bk" | "r", chatId: s[2] };
  const d = DERIVAR.exec(data);
  if (d) return { accion: "d", chatId: d[1], destino: d[2] === "bot" ? "bot" : Number(d[2]) };
  const t = TOMAR.exec(data);
  if (t) return { accion: "t", avisoId: t[1] };
  return null;
}
