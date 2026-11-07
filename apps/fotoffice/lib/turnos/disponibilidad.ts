/**
 * Horarios libres de un tipo de turno. Módulo PURO: sin base y sin red.
 *
 * Delega en el motor de Reservas (`computeAvailability` / `checkRange`) para que la pantalla ofrezca
 * exactamente lo que la reserva después acepta. La grilla es la duración del turno: un turno de
 * 30 minutos en la franja 10 a 12 ofrece 10:00, 10:30, 11:00 y 11:30.
 */
import { checkRange, computeAvailability, type RangeCheck, type SpaceRules } from "@/lib/bookings/availability";
import { parseLocalDateTime } from "@/lib/bookings/local-datetime";
import { localMoment, type Interval } from "@/lib/bookings/time";
import { ZONA_TURNOS, type AjustesTurnos } from "./constantes";
import type { Franja } from "./franjas";

export type ReglasTurno = Pick<AjustesTurnos, "bufferMinutes" | "minAdvanceHours" | "maxAdvanceDays"> & { durationMinutes: number };

export type EntradaDisponibilidad = {
  reglas: ReglasTurno;
  franjas: Franja[];
  ocupado: Interval[];
  ahora: Date;
};

function reglasDeEspacio(r: ReglasTurno): SpaceRules {
  return {
    slotMinutes: r.durationMinutes,
    minBookingMinutes: r.durationMinutes,
    maxBookingMinutes: r.durationMinutes,
    bufferMinutes: r.bufferMinutes,
    minAdvanceHours: r.minAdvanceHours,
    maxAdvanceDays: r.maxAdvanceDays,
  };
}

/** La ventana en que se buscan horarios: desde la medianoche de hoy hasta el último día permitido. */
export function ventanaDeBusqueda(ahora: Date, maxAdvanceDays: number): Interval {
  const hoy = localMoment(ahora, ZONA_TURNOS).ymd;
  const startAt = parseLocalDateTime(`${hoy}T00:00`, ZONA_TURNOS) as Date;
  return { startAt, endAt: new Date(startAt.getTime() + (maxAdvanceDays + 1) * 86_400_000) };
}

export function horariosLibres(e: EntradaDisponibilidad): Interval[] {
  if (e.franjas.length === 0 || e.reglas.durationMinutes <= 0) return [];
  return computeAvailability({
    space: reglasDeEspacio(e.reglas),
    range: ventanaDeBusqueda(e.ahora, e.reglas.maxAdvanceDays),
    weeklyHours: e.franjas,
    closures: [],
    busy: e.ocupado,
    now: e.ahora,
    timeZone: ZONA_TURNOS,
  });
}

/** ¿Se puede reservar este comienzo? Es la misma regla que usa `horariosLibres`. */
export function verificarHorario(inicio: Date, e: EntradaDisponibilidad): RangeCheck {
  const fin = new Date(inicio.getTime() + e.reglas.durationMinutes * 60_000);
  return checkRange(
    { startAt: inicio, endAt: fin },
    { space: reglasDeEspacio(e.reglas), weeklyHours: e.franjas, closures: [], busy: e.ocupado, now: e.ahora, timeZone: ZONA_TURNOS },
  );
}

export type DiaConHorarios = {
  /** "2026-11-10" */
  ymd: string;
  /** "martes 10 de noviembre" */
  etiqueta: string;
  horarios: { inicio: string; hora: string }[];
};

const FORMATO_DIA = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA_TURNOS, weekday: "long", day: "numeric", month: "long" });
const FORMATO_HORA = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA_TURNOS, hour: "2-digit", minute: "2-digit", hour12: false });

/** Los horarios agrupados por día de Argentina, en orden. */
export function agruparPorDia(horarios: Interval[]): DiaConHorarios[] {
  const dias = new Map<string, DiaConHorarios>();
  for (const h of horarios) {
    const ymd = localMoment(h.startAt, ZONA_TURNOS).ymd;
    let dia = dias.get(ymd);
    if (!dia) {
      dia = { ymd, etiqueta: FORMATO_DIA.format(h.startAt), horarios: [] };
      dias.set(ymd, dia);
    }
    dia.horarios.push({ inicio: h.startAt.toISOString(), hora: FORMATO_HORA.format(h.startAt) });
  }
  return [...dias.values()];
}

const FORMATO_LARGO = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_TURNOS, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});

/** "martes, 10 de noviembre de 2026, 10:30 h" */
export function fechaLarga(d: Date): string {
  return `${FORMATO_LARGO.format(d)} h`;
}
