import { eventDayType } from "@repo/cuanto-cobro-core";
import { diaDeSemana, diasEntre } from "./fechas";

/**
 * El horario fijo de una persona en un día. Módulo PURO.
 *
 * Sale de tres cosas, en este orden de prioridad:
 * 1. un cambio puntual de esa fecha (cambió el turno, faltó con aviso, vacaciones);
 * 2. el horario semanal (franjas por día), con los sábados alternados si corresponde;
 * 3. el feriado: el horario se muestra, pero ese día no se espera que trabaje (la alerta "no
 *    abrió" de la etapa de alertas no salta y el cumpleaños se adelanta a su último día de
 *    trabajo). Un cambio puntual "trabaja" en un feriado sí la espera.
 */

export type Franja = { inicioMin: number; finMin: number };
export type FranjaSemanal = Franja & { diaSemana: number };

export type FichaHorario = {
  franjas: readonly FranjaSemanal[];
  sabadosAlternados: boolean;
  /** Un sábado que le toca trabajar. Sin dato, se toma que trabaja todos los sábados. */
  sabadoReferencia: string | null;
};

export type TipoCambio = "TRABAJA" | "NO_TRABAJA";
export type MotivoCambio = "CAMBIO_TURNO" | "FALTA_CON_AVISO" | "VACACIONES" | "OTRO";

export const MOTIVOS_CAMBIO: Record<MotivoCambio, string> = {
  CAMBIO_TURNO: "Cambió el turno con una compañera",
  FALTA_CON_AVISO: "Faltó con aviso",
  VACACIONES: "Vacaciones",
  OTRO: "Otro motivo",
};

export type CambioPuntual = {
  fecha: string;
  tipo: TipoCambio;
  motivo: MotivoCambio;
  inicioMin: number | null;
  finMin: number | null;
};

export type OrigenHorario =
  /** Su horario semanal. */
  | "HORARIO"
  /** Un cambio puntual le puso otro horario. */
  | "CAMBIO"
  /** Un cambio puntual dice que ese día no trabaja. */
  | "NO_TRABAJA"
  /** Sábado alternado: ese sábado le toca a la otra persona. */
  | "SABADO_LIBRE"
  /** Su horario semanal no tiene nada ese día. */
  | "SIN_HORARIO";

export type HorarioDelDia = {
  fecha: string;
  franjas: Franja[];
  /** Minutos del horario fijo de ese día (la suma de las franjas). */
  minutos: number;
  /** Primera entrada y última salida del día; null si no tiene horario. */
  inicioMin: number | null;
  finMin: number | null;
  origen: OrigenHorario;
  motivo: MotivoCambio | null;
  /** Nombre del feriado nacional, si lo es. */
  feriado: string | null;
  /** Si ese día se espera que trabaje: tiene horario y no es feriado (salvo un cambio que diga que trabaja). */
  trabaja: boolean;
};

/**
 * Si un sábado le toca, con la regla "semana sí, semana no" contada desde `referencia`.
 * Sin referencia no se puede saber: se toma que le toca (la ficha avisa que falta el dato).
 */
export function leTocaElSabado(fecha: string, referencia: string | null): boolean {
  if (!referencia) return true;
  const semanas = Math.round(diasEntre(referencia, fecha) / 7);
  return semanas % 2 === 0;
}

function ordenar(franjas: Franja[]): Franja[] {
  return [...franjas].sort((a, b) => a.inicioMin - b.inicioMin);
}

function resumen(franjas: Franja[]) {
  const orden = ordenar(franjas);
  return {
    franjas: orden,
    minutos: orden.reduce((acc, f) => acc + Math.max(0, f.finMin - f.inicioMin), 0),
    inicioMin: orden.length > 0 ? orden[0].inicioMin : null,
    finMin: orden.length > 0 ? Math.max(...orden.map((f) => f.finMin)) : null,
  };
}

/** El nombre del feriado nacional de esa fecha, o null. */
export function feriadoDe(fecha: string): string | null {
  const info = eventDayType(fecha);
  return info && info.dayType === "holiday" ? info.holidayName : null;
}

export function horarioDelDia(
  ficha: FichaHorario,
  cambios: readonly CambioPuntual[],
  fecha: string,
): HorarioDelDia {
  const feriado = feriadoDe(fecha);
  const cambio = cambios.find((c) => c.fecha === fecha);

  if (cambio) {
    if (cambio.tipo === "NO_TRABAJA") {
      return { fecha, ...resumen([]), origen: "NO_TRABAJA", motivo: cambio.motivo, feriado, trabaja: false };
    }
    if (cambio.inicioMin !== null && cambio.finMin !== null && cambio.finMin > cambio.inicioMin) {
      const r = resumen([{ inicioMin: cambio.inicioMin, finMin: cambio.finMin }]);
      // Un cambio que dice "trabaja" la espera aunque sea feriado: se lo pidieron a propósito.
      return { fecha, ...r, origen: "CAMBIO", motivo: cambio.motivo, feriado, trabaja: true };
    }
  }

  const dia = diaDeSemana(fecha);
  const delDia = ficha.franjas
    .filter((f) => f.diaSemana === dia && f.finMin > f.inicioMin)
    .map((f) => ({ inicioMin: f.inicioMin, finMin: f.finMin }));

  if (delDia.length === 0) {
    return { fecha, ...resumen([]), origen: "SIN_HORARIO", motivo: null, feriado, trabaja: false };
  }
  if (dia === 5 && ficha.sabadosAlternados && !leTocaElSabado(fecha, ficha.sabadoReferencia)) {
    return { fecha, ...resumen([]), origen: "SABADO_LIBRE", motivo: null, feriado, trabaja: false };
  }
  const r = resumen(delDia);
  return { fecha, ...r, origen: "HORARIO", motivo: null, feriado, trabaja: feriado === null };
}

export type FranjasCheck = { ok: true; franjas: FranjaSemanal[] } | { ok: false; error: string };

/**
 * Valida el horario semanal que carga el dueño: cada franja con inicio antes del fin, dentro del
 * día, y sin pisarse con otra del mismo día.
 */
export function validarFranjas(franjas: readonly FranjaSemanal[]): FranjasCheck {
  for (const f of franjas) {
    if (!Number.isInteger(f.diaSemana) || f.diaSemana < 0 || f.diaSemana > 6) {
      return { ok: false, error: "Hay un día de la semana que no se entiende." };
    }
    if (f.inicioMin < 0 || f.finMin > 24 * 60 || f.finMin <= f.inicioMin) {
      return { ok: false, error: "En cada franja, la hora de salida tiene que ser después de la de entrada." };
    }
  }
  for (let d = 0; d < 7; d++) {
    const delDia = ordenar(franjas.filter((f) => f.diaSemana === d));
    for (let i = 1; i < delDia.length; i++) {
      if (delDia[i].inicioMin < delDia[i - 1].finMin) {
        return { ok: false, error: "Hay dos franjas del mismo día que se pisan." };
      }
    }
  }
  return { ok: true, franjas: [...franjas] };
}
