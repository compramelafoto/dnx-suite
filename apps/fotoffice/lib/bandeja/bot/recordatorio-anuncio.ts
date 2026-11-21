/**
 * PURO. Recordatorios a quien llegó de un anuncio de VHS o de XV y no contestó el primer mensaje del
 * bot (pedido de Daniel, 21/11/2026: muchos tocan el anuncio, leen y no siguen).
 *
 *   1. A la hora del mensaje del cliente, a cualquier hora del día (`PRIMERO_DESDE_HORAS`).
 *   2. Antes de que se cumplan las 24 h, con el mismo horario que el seguimiento de eventos: a las 22 h,
 *      de 7 a 21 h (`tocaSeguimientoDeEvento`).
 *
 * Cada uno sale una sola vez y sólo si el cliente no volvió a escribir. Los textos varían por chat para
 * que no parezcan automáticos.
 */
import { temaDeAnuncio, type AnuncioWa } from "../anuncio";
import { tocaSeguimientoDeEvento } from "./recordatorio-pago";

export type TemaRecordable = "VHS" | "XV";

export const PRIMERO_DESDE_HORAS = 1;
/** Si el primero no salió en este plazo (el cron no corrió), queda sólo el segundo. */
export const PRIMERO_HASTA_HORAS = 12;
/** Comienzo del SISTEMA que deja cada recordatorio en el chat (sirve para no repetirlo). */
export const MARCA_RECORDATORIO_ANUNCIO = "Recordatorio de consulta de anuncio";

const HORA_MS = 3_600_000;
const VHS = /\b(vhs|video|videos|casetes?|cassettes?|digitaliz\w*)\b/i;

export function temaRecordable(a: AnuncioWa): TemaRecordable | null {
  if (temaDeAnuncio(a) === "XV") return "XV";
  const t = [a.titulo, a.texto].filter(Boolean).join(" ");
  return VHS.test(t) ? "VHS" : null;
}

export function marcaRecordatorioAnuncio(n: 1 | 2): string {
  return `${MARCA_RECORDATORIO_ANUNCIO} ${n} enviado`;
}

/** ¿Cuál le toca ahora? `ya`: los recordatorios de anuncio que ya recibió este chat. */
export function cualRecordatorio(ultimoEntranteEn: Date | null, ahora: Date, ya: readonly (1 | 2)[]): 1 | 2 | null {
  if (!ultimoEntranteEn || ya.includes(2)) return null;
  const horas = (ahora.getTime() - ultimoEntranteEn.getTime()) / HORA_MS;
  if (tocaSeguimientoDeEvento(ultimoEntranteEn, ahora)) return 2;
  if (!ya.includes(1) && horas >= PRIMERO_DESDE_HORAS && horas <= PRIMERO_HASTA_HORAS) return 1;
  return null;
}

/** El nombre de pila si parece un nombre real (letras), si no null. */
function nombreDePila(nombre: string | null): string | null {
  const p = nombre?.trim().split(/\s+/)[0] ?? "";
  if (!/^\p{L}{2,}$/u.test(p)) return null;
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

/** Un número estable por chat, para que cada uno reciba siempre la misma variante. */
function semilla(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

type Variante = (n: string | null) => string;
const coma = (n: string | null) => (n ? `, ${n}` : "");
const hola = (n: string | null) => (n ? `¡Hola ${n}!` : "¡Hola!");

const TEXTOS: Record<TemaRecordable, Record<1 | 2, Variante[]>> = {
  VHS: {
    1: [
      (n) => `¿Pudiste ver mi mensaje${coma(n)}? 😊 Si me contás cuántos casetes tenés, te digo cuánto sale todo.`,
      (n) => `¿Llegaste a ver lo que te mandé${coma(n)}? 📼 Decime más o menos cuántos videos son y te paso el total.`,
    ],
    2: [
      (n) => `${hola(n)} Te escribo por los videos para digitalizar 📼 Si querés, te dejo todo listo y sólo los traés al estudio. ¿Cuántos son más o menos?`,
      (n) => `${hola(n)} ¿Pudiste buscar los casetes? 😊 Cuando me digas cuántos son, te paso el total y lo dejamos organizado.`,
    ],
  },
  XV: {
    1: [
      (n) => `¿Pudiste ver mi mensaje${coma(n)}? 😊 Pasame la fecha de los 15 y me fijo si la tenemos libre.`,
      (n) => `¿Llegaste a ver lo que te escribí${coma(n)}? 🙌 Contame para cuándo es la fiesta así reviso la agenda.`,
    ],
    2: [
      (n) => `${hola(n)} Te escribo por los 15 🎉 Como las fechas se van reservando, si me pasás el día de la fiesta me fijo enseguida si está libre. ¿Para cuándo es?`,
      (n) => `${hola(n)} ¿Cómo va la organización de los 15? 😊 Si ya tienen la fecha, pasámela y te confirmo si la tenemos libre.`,
    ],
  },
};

export function textoRecordatorioAnuncio(tema: TemaRecordable, n: 1 | 2, nombre: string | null, chatId: string): string {
  const opciones = TEXTOS[tema][n];
  return opciones[semilla(chatId) % opciones.length]!(nombreDePila(nombre));
}

export type MensajeParaRecordar = { direccion: string; autor: string; texto: string | null; media: unknown; createdAt: Date };

/**
 * Con la charla completa (en orden), ¿es una consulta de anuncio que quedó sin respuesta? Devuelve el
 * tema y qué recordatorios de anuncio ya salieron, o null si:
 *   - el primer mensaje del cliente no vino de un anuncio de VHS o XV;
 *   - el cliente escribió después de la primera respuesta del bot;
 *   - una persona del estudio escribió (la charla ya la lleva alguien);
 *   - ya salió otro seguimiento del bot (el de la consulta con precio).
 */
export function consultaDeAnuncioSinRespuesta(
  charla: readonly MensajeParaRecordar[],
  anuncioDe: (media: unknown) => AnuncioWa | null,
  marcasQueCortan: readonly string[],
): { tema: TemaRecordable; ya: (1 | 2)[] } | null {
  const primero = charla.find((m) => m.direccion === "ENTRANTE");
  const anuncio = primero ? anuncioDe(primero.media) : null;
  const tema = anuncio ? temaRecordable(anuncio) : null;
  if (!tema) return null;
  const respuesta = charla.find((m) => m.direccion === "SALIENTE" && m.autor === "BOT");
  if (!respuesta) return null;
  if (charla.some((m) => m.direccion === "ENTRANTE" && m.createdAt > respuesta.createdAt)) return null;
  if (charla.some((m) => m.direccion === "SALIENTE" && m.autor !== "BOT")) return null;
  const sistema = charla.filter((m) => m.direccion === "SISTEMA").map((m) => m.texto ?? "");
  if (sistema.some((t) => marcasQueCortan.some((x) => t.startsWith(x)))) return null;
  const ya = ([1, 2] as const).filter((n) => sistema.some((t) => t.startsWith(marcaRecordatorioAnuncio(n))));
  return { tema, ya };
}
