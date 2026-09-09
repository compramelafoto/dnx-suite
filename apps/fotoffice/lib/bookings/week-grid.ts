import type { WeeklyHour } from "./availability";
import { addMinutes, localMoment, minuteOfDayToLabel, type Interval } from "./time";

/**
 * La grilla semanal que ve quien reserva. Módulo PURO: sin base y sin red.
 *
 * ── Por qué una grilla y no una lista ──
 *
 * La primera versión mostraba los turnos libres como una fila de botones. Se leía como una
 * lista de números sueltos: no se veía qué días abre el espacio, ni dónde está el corte del
 * mediodía, ni qué está ocupado. Y no dejaba pedir más de un turno.
 *
 * Acá cada casillero dice su estado, y **las horas cerradas existen igual**: el hueco de 12
 * a 14 del coworking se ve como hueco. Que falte una fila y que esa fila esté cerrada son
 * dos cosas distintas para quien mira.
 */

export type CellState =
  /** Se puede reservar. */
  | "FREE"
  /** Dentro del horario, pero ya lo tomó alguien —o un espacio que no convive con este—. */
  | "TAKEN"
  /** El espacio no abre a esa hora ese día. */
  | "CLOSED"
  /** Ya pasó, o falta demasiado poco para reservarlo. */
  | "PAST";

export type GridCell = {
  startISO: string;
  endISO: string;
  /** Minutos desde la medianoche local. Es la fila. */
  minuteOfDay: number;
  state: CellState;
};

export type GridDay = {
  /** "2026-09-14" */
  ymd: string;
  /** "lun 14" */
  label: string;
  /** "14" — para el encabezado angosto del teléfono. */
  dayNumber: string;
  cells: GridCell[];
};

export type WeekGrid = {
  /** Los minutos del día que son fila, del primero al último. */
  rows: number[];
  days: GridDay[];
  slotMinutes: number;
};

const DIA = 24 * 60;

export function buildWeekGrid(input: {
  /** Lunes a la medianoche local. */
  weekStart: Date;
  weeklyHours: WeeklyHour[];
  freeSlots: Interval[];
  now: Date;
  timeZone: string;
  slotMinutes: number;
  minAdvanceHours: number;
}): WeekGrid {
  const { weeklyHours, slotMinutes } = input;

  if (weeklyHours.length === 0) {
    return {
      rows: [],
      days: diasDeLaSemana(input.weekStart, input.timeZone).map((d) => ({ ...d, cells: [] })),
      slotMinutes,
    };
  }

  // Las filas van del primer horario de la semana al último, atravesando los huecos: así el
  // corte del mediodía se ve, en vez de desaparecer.
  const desde = Math.min(...weeklyHours.map((h) => h.startMinute));
  const hasta = Math.max(...weeklyHours.map((h) => h.endMinute));
  const rows: number[] = [];
  for (let m = desde; m + slotMinutes <= hasta; m += slotMinutes) rows.push(m);

  // Los libres, indexados por instante, para no recorrer la lista en cada casillero.
  const libres = new Set(input.freeSlots.map((s) => s.startAt.getTime()));
  const noAntesDe = input.now.getTime() + input.minAdvanceHours * 60 * 60_000;

  const days = diasDeLaSemana(input.weekStart, input.timeZone).map((dia, i) => ({
    ...dia,
    cells: rows.map((row) => {
      const startAt = addMinutes(input.weekStart, i * DIA + row);
      const endAt = addMinutes(startAt, slotMinutes);

      // Se relee el momento local del casillero en vez de confiar en la aritmética: si
      // alguna vez la zona cambia de huso a mitad de semana, el casillero refleja la
      // realidad y no la cuenta que hicimos.
      const m = localMoment(startAt, input.timeZone);
      const abierto = weeklyHours.some(
        (h) =>
          h.weekday === m.weekday &&
          m.minuteOfDay >= h.startMinute &&
          m.minuteOfDay + slotMinutes <= h.endMinute,
      );

      const state: CellState = !abierto
        ? "CLOSED"
        : libres.has(startAt.getTime())
          ? "FREE"
          : startAt.getTime() < noAntesDe
            ? "PAST"
            : "TAKEN";

      return { startISO: startAt.toISOString(), endISO: endAt.toISOString(), minuteOfDay: row, state };
    }),
  }));

  return { rows, days, slotMinutes };
}

function diasDeLaSemana(
  weekStart: Date,
  timeZone: string,
): { ymd: string; label: string; dayNumber: string }[] {
  const largo = new Intl.DateTimeFormat("es-AR", { timeZone, weekday: "short", day: "numeric" });
  const corto = new Intl.DateTimeFormat("es-AR", { timeZone, day: "numeric" });
  return Array.from({ length: 7 }, (_, i) => {
    // Mediodía: inmune a cualquier salto de una hora por cambio de horario.
    const at = addMinutes(weekStart, i * DIA + 12 * 60);
    return {
      ymd: localMoment(at, timeZone).ymd,
      label: largo.format(at),
      dayNumber: corto.format(at),
    };
  });
}

export type RangeSelection =
  | { ok: true; startISO: string; endISO: string; minutes: number; cellCount: number }
  | { ok: false; motivo: string };

/**
 * Los dos toques de quien elige: uno en la hora de inicio y otro en la de fin.
 *
 * El orden no importa —se ordena solo—, y todo lo del medio tiene que estar libre. Cuando
 * no se puede, el motivo dice **qué** lo impide, no "no se puede": quien está eligiendo
 * necesita saber si mover el horario alcanza o si tiene que elegir otro día.
 */
export function selectRange(grid: WeekGrid, aISO: string, bISO: string): RangeSelection {
  const ubicar = (iso: string) => {
    for (const dia of grid.days) {
      const i = dia.cells.findIndex((c) => c.startISO === iso);
      if (i >= 0) return { dia, i };
    }
    return null;
  };

  const a = ubicar(aISO);
  const b = ubicar(bISO);
  if (!a || !b) return { ok: false, motivo: "Ese horario ya no está en la semana que mirás." };
  if (a.dia.ymd !== b.dia.ymd) {
    return { ok: false, motivo: "Una reserva tiene que empezar y terminar el mismo día." };
  }

  const desde = Math.min(a.i, b.i);
  const hasta = Math.max(a.i, b.i);
  const tramo = a.dia.cells.slice(desde, hasta + 1);

  if (tramo.some((c) => c.state === "CLOSED")) {
    return { ok: false, motivo: "En el medio hay un horario cerrado. Elegí un tramo seguido." };
  }
  const ocupada = tramo.find((c) => c.state === "TAKEN" || c.state === "PAST");
  if (ocupada) {
    return {
      ok: false,
      motivo: `Las ${minuteOfDayToLabel(ocupada.minuteOfDay)} están ocupadas. Elegí un tramo libre.`,
    };
  }

  return {
    ok: true,
    startISO: tramo[0].startISO,
    endISO: tramo[tramo.length - 1].endISO,
    minutes: tramo.length * grid.slotMinutes,
    cellCount: tramo.length,
  };
}
