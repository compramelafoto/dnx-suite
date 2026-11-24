/**
 * Filtros de la Bandeja (diseño 2026-11-24 §5.1): ejes independientes que viajan en la URL y se
 * combinan. Módulo PURO: lo usan las lecturas, las páginas y las pruebas.
 */

import { CANALES, type Canal } from "./constantes";
import { atiendeElBot, type EstadoChat } from "./reglas";

export const ESTADOS_FILTRO = ["abiertos", "esperando", "resueltos"] as const;
export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number];

export const ETIQUETA_ESTADO: Record<EstadoFiltro, string> = {
  abiertos: "Abiertos",
  esperando: "Esperando respuesta",
  resueltos: "Resueltos",
};

export type QuienFiltro = "todos" | "sin-asignar" | "bot" | number;

export type FiltrosBandeja = {
  quien: QuienFiltro;
  canal: "todos" | Canal;
  estado: EstadoFiltro;
  /** `todas`, un id de campaña, `ad:<adId>` (anuncio sin campaña conocida) o `sin-anuncio`. */
  campana: string;
  q: string;
};

export const FILTROS_POR_OMISION: FiltrosBandeja = { quien: "todos", canal: "todos", estado: "abiertos", campana: "todas", q: "" };

const CAMPANA_VALIDA = /^(sin-anuncio|ad:[0-9]{1,30}|[0-9]{1,30})$/;

const valor = (v: string | string[] | undefined): string => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

/** Lee los filtros de la URL. `yo` traduce el viejo `?filtro=mios`. Lo que no se reconoce queda por omisión. */
export function leerFiltros(params: Record<string, string | string[] | undefined>, yo: number | null): FiltrosBandeja {
  const f: FiltrosBandeja = { ...FILTROS_POR_OMISION };
  const quien = valor(params.quien);
  if (quien === "sin-asignar" || quien === "bot") f.quien = quien;
  else if (/^[1-9][0-9]{0,9}$/.test(quien)) f.quien = Number(quien);

  // Enlaces viejos (un solo eje): no rompen favoritos.
  const viejo = valor(params.filtro);
  if (viejo === "mios" && yo !== null) f.quien = yo;
  else if (viejo === "bot" || viejo === "sin-asignar") f.quien = viejo;
  else if (viejo === "resueltos") f.estado = "resueltos";

  const canal = valor(params.canal);
  if ((CANALES as readonly string[]).includes(canal)) f.canal = canal as Canal;
  const estado = valor(params.estado);
  if ((ESTADOS_FILTRO as readonly string[]).includes(estado)) f.estado = estado as EstadoFiltro;
  const campana = valor(params.campana);
  if (CAMPANA_VALIDA.test(campana)) f.campana = campana;
  f.q = valor(params.q).slice(0, 80);
  return f;
}

/** El enlace a la Bandeja (o a un chat) con estos filtros, sin los valores por omisión. */
export function hrefBandeja(f: FiltrosBandeja, base = "/bandeja"): string {
  const p = new URLSearchParams();
  if (f.quien !== "todos") p.set("quien", String(f.quien));
  if (f.canal !== "todos") p.set("canal", f.canal);
  if (f.estado !== "abiertos") p.set("estado", f.estado);
  if (f.campana !== "todas") p.set("campana", f.campana);
  if (f.q) p.set("q", f.q);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

/** Quién atiende un chat para el filtro: el bot, nadie («sin asignar») o el id de la persona. */
export function quienAtiende(chat: EstadoChat, ahora: Date): "bot" | "sin-asignar" | number {
  if (chat.asignadoUserId !== null) return chat.asignadoUserId;
  return atiendeElBot(chat, ahora) ? "bot" : "sin-asignar";
}
