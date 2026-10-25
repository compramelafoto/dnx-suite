import { isValidYmd, type CalendarView } from "@/lib/bookings/calendar-view";
import { CAPAS_POR_OMISION, CLAVES_CAPA, HUSO_HORARIO, esClaveCapa, type ClaveCapa } from "./constantes";
import { diaArgentina, diasQueOcupa, inicioDelDia, instanteArgentina, minutosDeHora, sumarDias } from "./fechas";

/**
 * Cálculos puros de la pantalla de Agenda (sin base, sin React): qué dice la dirección, cómo se
 * parten los eventos por día, cómo se mueve un evento al arrastrarlo y cómo se pasa del texto de un
 * formulario ("2026-10-09" + "15:30", hora de Argentina) al instante que se guarda.
 */

export type VistaPantalla = "dia" | "semana" | "mes" | "lista";
export const VISTAS_PANTALLA: readonly VistaPantalla[] = ["dia", "semana", "mes", "lista"];
export const ETIQUETA_VISTA: Record<VistaPantalla, string> = { dia: "Día", semana: "Semana", mes: "Mes", lista: "Lista" };

export type ParametrosAgenda = {
  fecha?: string;
  vista?: string;
  lista?: string;
  responsable?: string;
  cita?: string;
  nueva?: string;
  proyecto?: string;
  pedido?: string;
  consulta?: string;
};

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

export type ParametrosLeidos = {
  ymd: string;
  vista: VistaPantalla;
  /** La vista de calendario que rige la navegación (la lista recorre meses). */
  vistaCalendario: CalendarView;
  ownerUserId: number | null;
  citaId: string | null;
  nueva: { abrir: boolean; proyectoId: string | null; pedidoId: string | null; consultaLeadId: string | null };
};

/** Lo que dice la dirección. Lo raro vuelve a hoy / semana / sin filtro en vez de romper. */
export function leerParametros(p: ParametrosAgenda, ahora: Date): ParametrosLeidos {
  const ymd = isValidYmd(p.fecha) ? p.fecha : diaArgentina(ahora);
  const pedida = typeof p.vista === "string" && (VISTAS_PANTALLA as readonly string[]).includes(p.vista) ? (p.vista as VistaPantalla) : "semana";
  const vista: VistaPantalla = pedida === "lista" || (pedida === "mes" && p.lista === "1") ? "lista" : pedida;
  const resp = typeof p.responsable === "string" && /^\d{1,9}$/.test(p.responsable) ? Number(p.responsable) : null;
  const id = (v: string | undefined) => (typeof v === "string" && ID_VALIDO.test(v) ? v : null);
  return {
    ymd,
    vista,
    vistaCalendario: vista === "lista" ? "mes" : vista,
    ownerUserId: resp !== null && resp > 0 ? resp : null,
    citaId: id(p.cita),
    nueva: { abrir: p.nueva === "1", proyectoId: id(p.proyecto), pedidoId: id(p.pedido), consultaLeadId: id(p.consulta) },
  };
}

/** Lo que se conserva de la dirección al navegar (la lista y el filtro por responsable). */
export function conservarDeLaDireccion(vista: VistaPantalla, ownerUserId: number | null): Record<string, string | undefined> {
  return { lista: vista === "lista" ? "1" : undefined, responsable: ownerUserId !== null ? String(ownerUserId) : undefined };
}

/** Dirección de una vista de la Agenda. */
export function direccionAgenda(vista: VistaPantalla, ymd: string, ownerUserId: number | null): string {
  const q = new URLSearchParams();
  q.set("fecha", ymd);
  q.set("vista", vista === "lista" ? "mes" : vista);
  if (vista === "lista") q.set("lista", "1");
  if (ownerUserId !== null) q.set("responsable", String(ownerUserId));
  return `/agenda?${q.toString()}`;
}

// ── Eventos por día ──

export type Segmento = { ymd: string; desde: number; hasta: number };

/** Minutos desde las 00:00 de Argentina de `dia` hasta `instante` (puede salir negativo o mayor que 1440). */
export function minutosDesdeInicioDelDia(instante: Date, dia: string): number {
  return Math.round((instante.getTime() - inicioDelDia(dia).getTime()) / 60_000);
}

/** El tramo de un evento con hora que cae en cada uno de los `dias` dados (un evento que cruza la medianoche da dos). */
export function segmentosDelEvento(inicio: Date, fin: Date, dias: readonly string[]): Segmento[] {
  const out: Segmento[] = [];
  for (const ymd of dias) {
    const desde = Math.max(0, minutosDesdeInicioDelDia(inicio, ymd));
    const hasta = Math.min(1440, minutosDesdeInicioDelDia(fin, ymd));
    if (hasta > desde) out.push({ ymd, desde, hasta });
  }
  return out;
}

/** Los días (de entre `dias`) que ocupa un evento de todo el día. */
export function diasDeTodoElDia(inicio: Date, fin: Date, dias: readonly string[]): string[] {
  const ocupa = new Set(diasQueOcupa(inicio, fin));
  return dias.filter((d) => ocupa.has(d));
}

/** Redondea a múltiplos de `paso`. */
export function redondear(minutos: number, paso: number): number {
  return Math.round(minutos / paso) * paso;
}

export function horaDeMinuto(minutos: number): string {
  const m = ((Math.round(minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Corre un evento `delta` milisegundos (se usa al arrastrar: el evento conserva su duración). */
export function correrEvento(inicio: Date, fin: Date, deltaMs: number): { inicio: Date; fin: Date } {
  return { inicio: new Date(inicio.getTime() + deltaMs), fin: new Date(fin.getTime() + deltaMs) };
}

/** Cuánto hay que correr un evento para llevarlo del (día, minuto) de donde se lo agarró al (día, minuto) de donde se lo soltó. */
export function desplazamiento(desde: { ymd: string; minuto: number }, hacia: { ymd: string; minuto: number }): number {
  return instanteArgentina(hacia.ymd, hacia.minuto).getTime() - instanteArgentina(desde.ymd, desde.minuto).getTime();
}

/** Las horas que muestra la grilla: de 7 a 22 por omisión, estirado si algún evento cae afuera. */
export function limitesDeHoras(segmentos: readonly { desde: number; hasta: number }[], base = { desde: 7, hasta: 22 }): { startHour: number; endHour: number } {
  let desde = base.desde;
  let hasta = base.hasta;
  for (const s of segmentos) {
    desde = Math.min(desde, Math.floor(s.desde / 60));
    hasta = Math.max(hasta, Math.ceil(s.hasta / 60));
  }
  return { startHour: Math.max(0, desde), endHour: Math.min(24, Math.max(hasta, desde + 1)) };
}

// ── Formulario ↔ instantes ──

/** "2026-10-09" y "15:30" (hora de Argentina) → instante ISO; null si alguno no es válido. */
export function instanteDeFormulario(dia: string, hora: string): string | null {
  if (!isValidYmd(dia)) return null;
  const minutos = minutosDeHora(hora);
  if (minutos === null) return null;
  return instanteArgentina(dia, minutos).toISOString();
}

/** Día (Argentina) y hora "HH:MM" de un instante. */
export function partesDeInstante(iso: string): { dia: string; hora: string } {
  const d = new Date(iso);
  const dia = diaArgentina(d);
  return { dia, hora: horaDeMinuto(minutosDesdeInicioDelDia(d, dia)) };
}

/** El último día (inclusive) que ocupa un evento de todo el día: el fin es exclusivo, así que es el día anterior. */
export function ultimoDiaTodoElDia(inicioIso: string, finIso: string): string {
  const fin = new Date(finIso);
  const inicio = new Date(inicioIso);
  const ultimo = diaArgentina(new Date(Math.max(inicio.getTime(), fin.getTime() - 1)));
  return ultimo;
}

/** Inicio y fin (ISO) de una cita de todo el día entre dos días de calendario (ambos inclusive). */
export function rangoTodoElDia(diaInicio: string, diaFin: string): { startAt: string; endAt: string } | null {
  if (!isValidYmd(diaInicio) || !isValidYmd(diaFin) || diaFin < diaInicio) return null;
  return { startAt: inicioDelDia(diaInicio).toISOString(), endAt: inicioDelDia(sumarDias(diaFin, 1)).toISOString() };
}

// ── Capas encendidas (preferencia del navegador) ──

/** Lo que dice el navegador: las capas encendidas, o null si no hay nada guardado / no se puede leer. */
export function leerCapasGuardadas(texto: string | null | undefined): ClaveCapa[] | null {
  if (!texto) return null;
  try {
    const v: unknown = JSON.parse(texto);
    return Array.isArray(v) ? CLAVES_CAPA.filter((c) => v.includes(c)) : null;
  } catch {
    return null;
  }
}

/** Las capas que arrancan encendidas cuando nadie eligió: las del taller (o las de siempre) que la persona puede ver. */
export function capasIniciales(disponibles: readonly ClaveCapa[], delTaller: unknown): ClaveCapa[] {
  const base = Array.isArray(delTaller) ? delTaller.filter(esClaveCapa) : CAPAS_POR_OMISION;
  return disponibles.filter((c) => base.includes(c));
}

export const ZONA_DE_LA_AGENDA = HUSO_HORARIO;
