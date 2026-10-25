import { diaDeSemana, NOMBRES_DIAS, sumarDias } from "./fechas";
import { feriadoDe } from "./horario";

/**
 * El armado de los mensajes a las empleadas. Módulo PURO.
 *
 * Cada mensaje combina tres piezas del repertorio: un saludo, una frase del medio y un cierre.
 * Las piezas dependen del momento (al abrir la caja, 5 minutos antes de la salida o al cerrar)
 * y de las ocasiones del día (cumpleaños, feriado, víspera de feriado, fin de semana, fin de
 * mes). Con 15 a 20 variantes por pieza salen miles de combinaciones, y nunca se repite la
 * misma combinación a la misma persona en 30 días.
 *
 * La elección es determinística (sale de la persona, el día y el momento): si vuelve a entrar a
 * la pantalla, ve lo mismo y no un mensaje nuevo cada vez.
 */

export type Momento = "APERTURA" | "SALIDA" | "CIERRE";
export type MomentoPieza = Momento | "CUALQUIERA";
export type Parte = "SALUDO" | "MEDIO" | "CIERRE";
export type Ocasion = "CUMPLEANOS" | "FERIADO" | "VISPERA_FERIADO" | "FIN_DE_SEMANA" | "FIN_DE_MES";

export const MOMENTOS: readonly Momento[] = ["APERTURA", "SALIDA", "CIERRE"];
export const PARTES: readonly Parte[] = ["SALUDO", "MEDIO", "CIERRE"];
export const OCASIONES: readonly Ocasion[] = ["CUMPLEANOS", "FERIADO", "VISPERA_FERIADO", "FIN_DE_SEMANA", "FIN_DE_MES"];

export const ETIQUETA_MOMENTO: Record<MomentoPieza, string> = {
  APERTURA: "Al abrir la caja",
  SALIDA: "5 minutos antes de la salida",
  CIERRE: "Al cerrar la caja",
  CUALQUIERA: "En cualquier momento",
};
export const ETIQUETA_PARTE: Record<Parte, string> = { SALUDO: "Saludo", MEDIO: "Frase del medio", CIERRE: "Cierre" };
export const ETIQUETA_OCASION: Record<Ocasion, string> = {
  CUMPLEANOS: "Cumpleaños",
  FERIADO: "Trabaja en un feriado",
  VISPERA_FERIADO: "Víspera de feriado",
  FIN_DE_SEMANA: "Fin de semana",
  FIN_DE_MES: "Fin de mes",
};

/** Las variables que se pueden escribir en una pieza. */
export const VARIABLES = ["{nombre}", "{dia}", "{ventas}", "{feriado}"] as const;

export type Pieza = {
  id: string;
  momento: MomentoPieza;
  parte: Parte;
  ocasion: Ocasion | null;
  texto: string;
  activa: boolean;
};

/** Cuántos días no se repite la misma combinación a la misma persona. */
export const DIAS_SIN_REPETIR = 30;

/**
 * Las ocasiones del día para esa persona.
 *
 * - Feriado: si hoy es feriado nacional (y está trabajando).
 * - Víspera de feriado: si mañana lo es.
 * - Fin de semana: el sábado, y el viernes si ese sábado no le toca trabajar (decir "lindo fin
 *   de semana" a quien vuelve mañana suena raro).
 * - Fin de mes: si no le queda ningún día de trabajo en el mes.
 */
export function ocasionesDelDia(p: {
  fecha: string;
  cumple: boolean;
  trabaja: (fecha: string) => boolean;
}): { ocasiones: Ocasion[]; feriado: string | null } {
  const ocasiones: Ocasion[] = [];
  if (p.cumple) ocasiones.push("CUMPLEANOS");
  const feriado = feriadoDe(p.fecha);
  if (feriado) ocasiones.push("FERIADO");
  if (feriadoDe(sumarDias(p.fecha, 1))) ocasiones.push("VISPERA_FERIADO");
  const dia = diaDeSemana(p.fecha);
  if (dia === 5 || (dia === 4 && !p.trabaja(sumarDias(p.fecha, 1)))) ocasiones.push("FIN_DE_SEMANA");
  const mes = p.fecha.slice(0, 7);
  let quedan = false;
  for (let d = sumarDias(p.fecha, 1); d.slice(0, 7) === mes; d = sumarDias(d, 1)) {
    if (p.trabaja(d)) {
      quedan = true;
      break;
    }
  }
  if (!quedan) ocasiones.push("FIN_DE_MES");
  return { ocasiones, feriado };
}

export type ContextoMensaje = {
  momento: Momento;
  fecha: string;
  nombre: string;
  ventasHoy: number;
  ocasiones: readonly Ocasion[];
  feriado: string | null;
  /** Combinaciones ("id|id|id") que ya se le mostraron en los últimos 30 días. */
  usadas: readonly string[];
  /** Ids de piezas que se le mostraron hace poco: se dejan para el final, para que no se repitan seguido. */
  recientes?: readonly string[];
  /** Semilla de la elección (por omisión, el día y el momento). */
  semilla: string;
};

export type MensajeArmado = {
  texto: string;
  combinacion: string;
  piezas: string[];
  /** Las ocasiones que efectivamente usó, separadas por coma, o null. */
  ocasion: string | null;
};

/** Hash FNV-1a de 32 bits: alcanza para sembrar el sorteo. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Generador mulberry32: determinístico a partir de la semilla. */
function generador(semilla: number): () => number {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mezclar<T>(lista: readonly T[], azar: () => number): T[] {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function textoVentas(n: number): string {
  return n === 1 ? "1 venta" : `${n} ventas`;
}

/** Reemplaza las variables y ordena los espacios. */
export function completarTexto(texto: string, ctx: Pick<ContextoMensaje, "nombre" | "fecha" | "ventasHoy" | "feriado">): string {
  return texto
    .replaceAll("{nombre}", ctx.nombre)
    .replaceAll("{dia}", NOMBRES_DIAS[diaDeSemana(ctx.fecha)])
    .replaceAll("{ventas}", textoVentas(ctx.ventasHoy))
    .replaceAll("{feriado}", ctx.feriado ?? "feriado")
    .replace(/\s+/g, " ")
    .trim();
}

function sirveParaElMomento(p: Pieza, momento: Momento): boolean {
  return p.activa && (p.momento === momento || p.momento === "CUALQUIERA");
}

/** Una pieza que habla de las ventas no sirve el día que no hubo ninguna. */
function sirveParaElDia(p: Pieza, ctx: ContextoMensaje): boolean {
  if (p.texto.includes("{ventas}") && ctx.ventasHoy <= 0) return false;
  if (p.texto.includes("{feriado}") && !ctx.feriado) return false;
  return true;
}

type Eleccion = { piezas: Pieza[]; ocasion: Ocasion | null };

/**
 * Las piezas candidatas para una parte, con la ocasión que corresponde. Si el dueño apagó todas
 * las de una ocasión, se usan las de todos los días.
 */
function candidatas(piezas: readonly Pieza[], parte: Parte, ctx: ContextoMensaje): Eleccion {
  const base = piezas.filter((p) => p.parte === parte && sirveParaElMomento(p, ctx.momento) && sirveParaElDia(p, ctx));
  const comunes = base.filter((p) => p.ocasion === null);
  const de = (o: Ocasion) => base.filter((p) => p.ocasion === o);
  const tiene = (o: Ocasion) => ctx.ocasiones.includes(o);

  const prioridad: Ocasion[] =
    parte === "SALUDO"
      ? ["CUMPLEANOS"]
      : parte === "MEDIO"
        ? ctx.momento === "CIERRE"
          ? ["FERIADO", "FIN_DE_MES"]
          : ["FERIADO"]
        : ctx.momento === "CIERRE"
          ? ["VISPERA_FERIADO", "FIN_DE_SEMANA"]
          : [];
  for (const o of prioridad) {
    if (tiene(o) && de(o).length > 0) return { piezas: de(o), ocasion: o };
  }
  return { piezas: comunes, ocasion: null };
}

/**
 * Arma el mensaje. Devuelve null si el repertorio no tiene ninguna pieza para ese momento.
 */
export function armarMensaje(piezas: readonly Pieza[], ctx: ContextoMensaje): MensajeArmado | null {
  const azar = generador(hash(ctx.semilla));
  const recientes = new Set(ctx.recientes ?? []);
  const ordenar = (lista: Pieza[]) => {
    const mezcla = mezclar(lista, azar);
    return [...mezcla.filter((p) => !recientes.has(p.id)), ...mezcla.filter((p) => recientes.has(p.id))];
  };

  const elecciones = PARTES.map((parte) => candidatas(piezas, parte, ctx));
  if (elecciones.every((e) => e.piezas.length === 0)) return null;
  // Una parte sin piezas no traba el mensaje: se arma con las otras.
  const listas = elecciones.map((e) => (e.piezas.length > 0 ? ordenar(e.piezas) : [null]));
  const usadas = new Set(ctx.usadas);

  const clave = (combo: (Pieza | null)[]) => combo.map((p) => p?.id ?? "-").join("|");
  let elegida: (Pieza | null)[] | null = null;
  buscar: for (const a of listas[0]) {
    for (const b of listas[1]) {
      for (const c of listas[2]) {
        if (!usadas.has(clave([a, b, c]))) {
          elegida = [a, b, c];
          break buscar;
        }
      }
    }
  }
  // Si ya se usaron todas (un repertorio muy chico), se repite antes que no saludar.
  if (!elegida) elegida = [listas[0][0], listas[1][0], listas[2][0]];

  const texto = elegida
    .filter((p): p is Pieza => p !== null)
    .map((p) => completarTexto(p.texto, ctx))
    .join(" ");
  const ocasionesUsadas = elecciones.map((e) => e.ocasion).filter((o): o is Ocasion => o !== null);
  return {
    texto,
    combinacion: clave(elegida),
    piezas: elegida.filter((p): p is Pieza => p !== null).map((p) => p.id),
    ocasion: ocasionesUsadas.length > 0 ? [...new Set(ocasionesUsadas)].join(",") : null,
  };
}

/**
 * Cuándo se muestra el aviso de salida: desde 5 minutos antes del fin de su horario, si tiene
 * un turno abierto a su nombre y no lo cerró con la cruz.
 */
export const MINUTOS_AVISO_SALIDA = 5;

export function avisoDeSalidaVisible(p: {
  ahoraMin: number;
  finMin: number | null;
  tieneTurnoPropioAbierto: boolean;
  cerrado: boolean;
}): boolean {
  if (p.finMin === null || !p.tieneTurnoPropioAbierto || p.cerrado) return false;
  return p.ahoraMin >= p.finMin - MINUTOS_AVISO_SALIDA;
}
