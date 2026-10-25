import { diaYMinuto, minutosDesdeElDia } from "./fechas";
import type { HorarioDelDia } from "./horario";

/**
 * La jornada de una persona en un día, sacada de los turnos de caja. Módulo PURO.
 *
 * - Entrada real: la apertura del primer turno que abrió ella ese día.
 * - Salida real: el cierre de su último turno, si lo cerró ella misma.
 * - Si su último turno lo cerró otra persona, la jornada queda "sin cierre propio" y como
 *   referencia se toma su última actividad del día (una venta o un movimiento que cargó ella).
 * - Una corrección a mano del dueño reemplaza la entrada o la salida, y queda marcada.
 *
 * Todas las horas son minutos desde la medianoche de ESE día en hora argentina; un cierre
 * pasada la medianoche da más de 1440 en vez de caer en otro día.
 */

export type TurnoParaJornada = {
  id: string;
  openedAt: Date;
  openedByUserId: number | null;
  closedAt: Date | null;
  closedByUserId: number | null;
};

export type CorreccionJornada = { entradaMin: number | null; salidaMin: number | null; nota: string };

export type EstadoJornada =
  /** Abrió y cerró ella misma. */
  | "COMPLETA"
  /** Abrió su turno y sigue abierto. */
  | "TURNO_ABIERTO"
  /** Su turno lo cerró otra persona. */
  | "SIN_CIERRE_PROPIO"
  /** No abrió ningún turno, pero cargó ventas o movimientos (vendió en el turno de otra). */
  | "SIN_APERTURA_PROPIA"
  /** Ni turnos ni actividad. */
  | "SIN_DATOS";

export type Jornada = {
  fecha: string;
  estado: EstadoJornada;
  entradaMin: number | null;
  salidaMin: number | null;
  /** La salida no es un cierre propio: es su última actividad. */
  salidaEsReferencia: boolean;
  corregida: boolean;
  nota: string | null;
  /** Turnos que abrió ese día. */
  turnosPropios: number;
  /** Ese día cerró el turno que había abierto otra persona (el pase de turno). */
  cerroTurnoAjeno: boolean;
  trabajadosMin: number;
  programadosMin: number;
  llegadaTardeMin: number;
  salidaTempranaMin: number;
  extraMin: number;
  /** De ese tiempo de más, cuánto fue sin ninguna venta ni movimiento cargado por ella. */
  extraSinActividadMin: number;
  /** Lo que supera la tolerancia (lo que la etapa de alertas va a mostrar). */
  fueraDeTolerancia: { tarde: boolean; temprano: boolean; extra: boolean };
  actividades: number;
};

export type EntradaJornada = {
  userId: number;
  fecha: string;
  /** Los turnos de las cuentas de mostrador; acá se filtran los de ese día. */
  turnos: readonly TurnoParaJornada[];
  /** Cuándo cargó cada venta o movimiento de ese día. */
  actividades: readonly Date[];
  horario: HorarioDelDia;
  toleranciaMin: number;
  correccion?: CorreccionJornada | null;
};

const delDia = (fecha: string, instante: Date) => diaYMinuto(instante).fecha === fecha;

export function calcularJornada(e: EntradaJornada): Jornada {
  const { fecha, userId, horario } = e;
  const propios = e.turnos
    .filter((t) => t.openedByUserId === userId && delDia(fecha, t.openedAt))
    .sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
  const cerroTurnoAjeno = e.turnos.some(
    (t) => t.openedByUserId !== userId && t.closedByUserId === userId && t.closedAt !== null && delDia(fecha, t.closedAt),
  );
  const acts = e.actividades
    .filter((a) => delDia(fecha, a))
    .map((a) => minutosDesdeElDia(fecha, a))
    .sort((a, b) => a - b);

  let estado: EstadoJornada;
  let entradaMin: number | null = null;
  let salidaMin: number | null = null;
  let salidaEsReferencia = false;

  if (propios.length > 0) {
    entradaMin = minutosDesdeElDia(fecha, propios[0].openedAt);
    const ultimo = propios[propios.length - 1];
    if (ultimo.closedAt === null) {
      estado = "TURNO_ABIERTO";
    } else if (ultimo.closedByUserId === userId) {
      estado = "COMPLETA";
      salidaMin = minutosDesdeElDia(fecha, ultimo.closedAt);
    } else {
      estado = "SIN_CIERRE_PROPIO";
      const desde = minutosDesdeElDia(fecha, ultimo.openedAt);
      const posteriores = acts.filter((a) => a >= desde);
      salidaMin = posteriores.length > 0 ? posteriores[posteriores.length - 1] : desde;
      salidaEsReferencia = true;
    }
  } else if (acts.length > 0) {
    estado = "SIN_APERTURA_PROPIA";
    entradaMin = acts[0];
    salidaMin = acts[acts.length - 1];
    salidaEsReferencia = true;
  } else {
    estado = "SIN_DATOS";
  }

  const c = e.correccion ?? null;
  const corregida = c !== null && (c.entradaMin !== null || c.salidaMin !== null);
  if (c?.entradaMin != null) entradaMin = c.entradaMin;
  if (c?.salidaMin != null) {
    salidaMin = c.salidaMin;
    salidaEsReferencia = false;
  }

  const trabajadosMin = entradaMin !== null && salidaMin !== null ? Math.max(0, salidaMin - entradaMin) : 0;

  let llegadaTardeMin = 0;
  let salidaTempranaMin = 0;
  let extraMin = 0;
  let extraSinActividadMin = 0;

  if (entradaMin !== null) {
    if (horario.inicioMin !== null && horario.finMin !== null) {
      const inicio = horario.inicioMin;
      const fin = horario.finMin;
      llegadaTardeMin = Math.max(0, entradaMin - inicio);
      const antes = Math.max(0, inicio - entradaMin);
      if (antes > 0) {
        const primera = acts.find((a) => a >= entradaMin!);
        extraSinActividadMin += Math.min(inicio, primera ?? inicio) - entradaMin;
      }
      extraMin += antes;
      if (salidaMin !== null) {
        salidaTempranaMin = Math.max(0, fin - salidaMin);
        const despues = Math.max(0, salidaMin - fin);
        if (despues > 0) {
          const previas = acts.filter((a) => a <= salidaMin!);
          const ultima = previas.length > 0 ? previas[previas.length - 1] : null;
          extraSinActividadMin += salidaMin - Math.max(fin, ultima ?? fin);
        }
        extraMin += despues;
      }
    } else if (salidaMin !== null) {
      // Un día sin horario: todo lo trabajado es de más. Sin actividad es lo que queda fuera
      // del tramo entre su primera y su última venta o movimiento.
      extraMin = trabajadosMin;
      const dentro = acts.filter((a) => a >= entradaMin! && a <= salidaMin!);
      const activo = dentro.length > 0 ? dentro[dentro.length - 1] - dentro[0] : 0;
      extraSinActividadMin = Math.max(0, trabajadosMin - activo);
    }
  }

  const tol = Math.max(0, e.toleranciaMin);
  return {
    fecha,
    estado,
    entradaMin,
    salidaMin,
    salidaEsReferencia,
    corregida,
    nota: c?.nota ?? null,
    turnosPropios: propios.length,
    cerroTurnoAjeno,
    trabajadosMin,
    programadosMin: horario.minutos,
    llegadaTardeMin,
    salidaTempranaMin,
    extraMin,
    extraSinActividadMin: Math.max(0, extraSinActividadMin),
    fueraDeTolerancia: {
      tarde: llegadaTardeMin > tol,
      temprano: salidaTempranaMin > tol,
      extra: extraMin > tol,
    },
    actividades: acts.length,
  };
}

export const ETIQUETAS_ESTADO: Record<EstadoJornada, string> = {
  COMPLETA: "Abrió y cerró",
  TURNO_ABIERTO: "Turno abierto",
  SIN_CIERRE_PROPIO: "Sin cierre propio",
  SIN_APERTURA_PROPIA: "Vendió sin abrir turno",
  SIN_DATOS: "Sin datos de caja",
};
