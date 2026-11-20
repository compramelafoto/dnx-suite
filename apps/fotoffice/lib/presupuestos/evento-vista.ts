/**
 * Lo que la cotización muestra del evento y de las aperturas del cliente. Módulo PURO (sin base
 * ni `server-only`): lo usan la ficha, el listado y sus pruebas.
 *
 * Los datos del evento se leen siempre de la consulta (`evento-de-cotizacion.ts`): la cotización
 * no guarda copia, así una corrección en la consulta se ve enseguida acá.
 */
import { fechaDeEvento } from "@/lib/ficha/formato";

const ZONA = "America/Argentina/Buenos_Aires";
const horaAR = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const diaMesAR = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "2-digit", month: "2-digit" });
const diaSemanaAR = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, weekday: "long" });
const diaSemanaUTC = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long" });

export type EventoDeCotizacion = {
  /** La categoría de la consulta (o el tipo de evento viejo). */
  tipo: string | null;
  fecha: Date | null;
  /** Si la fecha trae hora cargada (si no, es sólo el día). */
  horaConocida: boolean;
  lugar: string | null;
  ceremonia: string | null;
  recepcion: string | null;
  ciudad: string | null;
  invitados: number | null;
  /** "Ana y Pablo", cuando la consulta los tiene. */
  protagonistas: string | null;
  origen: string | null;
  mensaje: string | null;
  /** Respuestas del formulario / del presupuesto por horas (`metaJson.porHoras`). */
  horas: number | null;
  km: number | null;
  segundoFotografo: boolean;
};

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const numeroONull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Puro: las respuestas del presupuesto por horas que la consulta guarda en `metaJson.porHoras`. */
export function respuestasDelFormulario(metaJson: unknown): { horas: number | null; km: number | null; segundoFotografo: boolean } {
  const d = esObjeto(metaJson) && esObjeto(metaJson.porHoras) ? metaJson.porHoras : null;
  if (!d) return { horas: null, km: null, segundoFotografo: false };
  return { horas: numeroONull(d.horas), km: numeroONull(d.km), segundoFotografo: d.segundoFotografo === true };
}

export type LineaDeEvento = { termino: string; valor: string };

const limpio = (s: string | null | undefined): string | null => {
  const t = s?.replace(/\s+/g, " ").trim();
  return t ? t : null;
};

const numeroAR = (n: number) => String(n).replace(".", ",");

/** "sábado 12/12/2026" (y " · 21:00 h" si la hora es conocida). */
export function textoDeFechaDelEvento(fecha: Date, horaConocida: boolean): string {
  // Las fechas sin hora se guardan a las 00:00 UTC: el día de la semana se lee en UTC para no correrlo.
  const dia = (horaConocida ? diaSemanaAR : diaSemanaUTC).format(fecha);
  const base = `${dia} ${fechaDeEvento(fecha)}`;
  return horaConocida ? `${base} · ${horaAR.format(fecha)} h` : base;
}

/** Las líneas del recuadro "Evento", en orden; sólo las que tienen dato. */
export function lineasDelEvento(e: EventoDeCotizacion): LineaDeEvento[] {
  const lineas: [string, string | null][] = [
    ["Tipo de evento", limpio(e.tipo)],
    ["Fecha", e.fecha ? textoDeFechaDelEvento(e.fecha, e.horaConocida) : null],
    ["Protagonistas", limpio(e.protagonistas)],
    ["Lugar", limpio(e.lugar)],
    ["Ceremonia", limpio(e.ceremonia)],
    ["Fiesta", limpio(e.recepcion)],
    ["Ciudad", limpio(e.ciudad)],
    ["Invitados", e.invitados !== null && e.invitados > 0 ? String(e.invitados) : null],
    ["Horas de cobertura", e.horas !== null && e.horas > 0 ? `${numeroAR(e.horas)} h` : null],
    ["Segundo fotógrafo", e.segundoFotografo ? "Sí, lo pidió" : null],
    ["Distancia desde el estudio", e.km !== null && e.km > 0 ? `${numeroAR(Math.round(e.km))} km` : null],
    ["Origen", limpio(e.origen)],
  ];
  return lineas.filter((l): l is [string, string] => l[1] !== null).map(([termino, valor]) => ({ termino, valor }));
}

export type ResumenDeVistas = { veces: number; primera: Date; ultima: Date };

/** Junta las aperturas (una fecha por apertura) en un resumen; null si no hubo ninguna. */
export function resumirVistas(aperturas: readonly Date[]): ResumenDeVistas | null {
  if (aperturas.length === 0) return null;
  let primera = aperturas[0]!;
  let ultima = aperturas[0]!;
  for (const a of aperturas) {
    if (a < primera) primera = a;
    if (a > ultima) ultima = a;
  }
  return { veces: aperturas.length, primera, ultima };
}

const vecesTexto = (n: number) => (n === 1 ? "1 vez" : `${n} veces`);
const diaHora = (d: Date) => `${diaMesAR.format(d)} ${horaAR.format(d)}`;

/** Para la ficha: "Sí: la abrió 2 veces. Primera 15/11 21:40, última 17/11 09:12." */
export function textoDeVistas(r: ResumenDeVistas | null, enviada: boolean): string {
  if (!r) return enviada ? "Todavía no la abrió." : "Todavía no se envió.";
  if (r.veces === 1) return `Sí: la abrió 1 vez, el ${diaHora(r.primera)}.`;
  return `Sí: la abrió ${vecesTexto(r.veces)}. Primera ${diaHora(r.primera)}, última ${diaHora(r.ultima)}.`;
}

/** Para el listado, debajo del estado: "2 veces · última 17/11". */
export function textoCortoDeVistas(r: ResumenDeVistas | null): string | null {
  if (!r) return null;
  return r.veces === 1 ? `Abierta el ${diaMesAR.format(r.primera)}` : `${vecesTexto(r.veces)} · última ${diaMesAR.format(r.ultima)}`;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;
const ymdAR = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });
const ymdUTC = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });

/** La fecha del evento partida para la hoja de calendario del encabezado de la cotización. */
export type HojaDeCalendario = {
  /** "aaaa-mm-dd" del evento en Argentina. */
  ymd: string;
  diaSemana: string;
  dia: string;
  mes: string;
  anio: string;
  /** "21:30 h", sólo si la hora es conocida. */
  hora: string | null;
};

/** Puro: la fecha del evento como hoja de calendario (sin correr el día de las fechas sin hora). */
export function hojaDeCalendario(fecha: Date, horaConocida: boolean): HojaDeCalendario {
  const ymd = (horaConocida ? ymdAR : ymdUTC).format(fecha);
  const [anio, mes, dia] = ymd.split("-") as [string, string, string];
  return {
    ymd,
    diaSemana: (horaConocida ? diaSemanaAR : diaSemanaUTC).format(fecha),
    dia: String(Number(dia)),
    mes: MESES_CORTOS[Number(mes) - 1] ?? mes,
    anio,
    hora: horaConocida ? `${horaAR.format(fecha)} h` : null,
  };
}

/** Puro: cuánto falta para el evento, entre dos "aaaa-mm-dd" (el de hoy en Argentina). */
export function textoDeCuantoFalta(ymdEvento: string, ymdHoy: string): string {
  const dias = Math.round((Date.parse(`${ymdEvento}T00:00:00Z`) - Date.parse(`${ymdHoy}T00:00:00Z`)) / 86_400_000);
  if (!Number.isFinite(dias)) return "";
  if (dias === 0) return "Es hoy";
  if (dias === 1) return "Es mañana";
  if (dias === -1) return "Fue ayer";
  return dias > 0 ? `Faltan ${dias} días` : `Fue hace ${-dias} días`;
}
