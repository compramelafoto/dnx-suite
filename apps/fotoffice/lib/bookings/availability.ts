import { type Interval, addMinutes, expandInterval, localMoment, overlaps } from "./time";

/**
 * Motor de disponibilidad. Módulo PURO: sin base y sin red.
 *
 * Recibe TODO resuelto —los horarios del espacio, los cierres, la ocupación y la ventana
 * pedida— y devuelve los huecos libres. Quien llama es responsable de haber juntado en
 * `busy` la ocupación del espacio Y la de los espacios incompatibles: acá no se distingue
 * de quién es cada rango ocupado, y eso es lo que mantiene simple la regla de convivencia.
 */

export type SpaceRules = {
  /** Grilla de la agenda, en minutos. 60 = por hora. */
  slotMinutes: number;
  minBookingMinutes: number;
  /** null = sin tope. */
  maxBookingMinutes: number | null;
  /** Tiempo de limpieza que ocupa a los dos lados de cada reserva. */
  bufferMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
};

export type WeeklyHour = {
  /** 0 domingo … 6 sábado, en la zona de la institución. */
  weekday: number;
  startMinute: number;
  endMinute: number;
};

export type AvailabilityInput = {
  space: SpaceRules;
  range: Interval;
  weeklyHours: WeeklyHour[];
  closures: Interval[];
  /** Reservas del espacio, de sus incompatibles, y bloqueos traídos del calendario. */
  busy: Interval[];
  now: Date;
  timeZone: string;
};

export type BookingRejection =
  | "FUERA_DE_HORARIO"
  | "OCUPADO"
  | "CERRADO"
  | "MUY_SOBRE_LA_HORA"
  | "DEMASIADO_LEJOS"
  | "DURACION_INVALIDA"
  | "FUERA_DE_GRILLA"
  | "RANGO_INVALIDO";

export type RangeCheck = { ok: true } | { ok: false; reason: BookingRejection };

const MINUTO = 60_000;

/**
 * El tramo de horario semanal que contiene al rango entero, o null.
 *
 * Devuelve el tramo y no un sí/no porque la grilla se mide DESDE EL COMIENZO DEL TRAMO: un
 * espacio que abre 09:30 con turnos de una hora arranca a las 9:30, no a las 10.
 *
 * Se compara contra el día del COMIENZO: una reserva que cruzara la medianoche no cabría en
 * ningún tramo y quedaría rechazada, que es lo correcto mientras los horarios se declaren
 * por día.
 */
function tramoQueContiene(
  range: Interval,
  input: Omit<AvailabilityInput, "range">,
): WeeklyHour | null {
  const inicio = localMoment(range.startAt, input.timeZone);
  const duracion = (range.endAt.getTime() - range.startAt.getTime()) / MINUTO;
  const fin = inicio.minuteOfDay + duracion;

  return (
    input.weeklyHours.find(
      (h) =>
        h.weekday === inicio.weekday && inicio.minuteOfDay >= h.startMinute && fin <= h.endMinute,
    ) ?? null
  );
}

function ocupado(range: Interval, input: Omit<AvailabilityInput, "range">): boolean {
  return input.busy.some((b) => overlaps(range, expandInterval(b, input.space.bufferMinutes)));
}

function cerrado(range: Interval, input: Omit<AvailabilityInput, "range">): boolean {
  return input.closures.some((c) => overlaps(range, c));
}

/**
 * ¿Se puede reservar exactamente este rango?
 *
 * El orden de los motivos importa: primero lo que está mal en el pedido mismo (rango
 * inválido, duración), después lo que depende del reloj, y al final lo que depende de otros.
 * Así el mensaje que recibe la persona habla de lo que ella puede corregir.
 */
export function checkRange(range: Interval, input: Omit<AvailabilityInput, "range">): RangeCheck {
  const duracion = (range.endAt.getTime() - range.startAt.getTime()) / MINUTO;
  if (!Number.isFinite(duracion) || duracion <= 0) return { ok: false, reason: "RANGO_INVALIDO" };

  const { space } = input;
  if (duracion < space.minBookingMinutes) return { ok: false, reason: "DURACION_INVALIDA" };
  if (space.maxBookingMinutes !== null && duracion > space.maxBookingMinutes) {
    return { ok: false, reason: "DURACION_INVALIDA" };
  }
  if (duracion % space.slotMinutes !== 0) return { ok: false, reason: "DURACION_INVALIDA" };

  const desde = input.now.getTime() + space.minAdvanceHours * 60 * MINUTO;
  if (range.startAt.getTime() < desde) return { ok: false, reason: "MUY_SOBRE_LA_HORA" };

  const hasta = input.now.getTime() + space.maxAdvanceDays * 24 * 60 * MINUTO;
  if (range.startAt.getTime() > hasta) return { ok: false, reason: "DEMASIADO_LEJOS" };

  const tramo = tramoQueContiene(range, input);
  if (tramo === null) return { ok: false, reason: "FUERA_DE_HORARIO" };

  // La grilla se mide desde el comienzo del tramo, no desde la medianoche.
  const desdeElTramo = localMoment(range.startAt, input.timeZone).minuteOfDay - tramo.startMinute;
  if (desdeElTramo % space.slotMinutes !== 0) return { ok: false, reason: "FUERA_DE_GRILLA" };

  if (cerrado(range, input)) return { ok: false, reason: "CERRADO" };
  if (ocupado(range, input)) return { ok: false, reason: "OCUPADO" };

  return { ok: true };
}

/**
 * Los huecos libres dentro de la ventana pedida.
 *
 * Se recorre la grilla del espacio y se pregunta por cada casillero. Es el camino más
 * lento posible y también el único que no puede discrepar de `checkRange`: la pantalla
 * ofrece exactamente lo que la validación después acepta. Para una ventana de un mes con
 * grilla de media hora son ~1.500 evaluaciones, que es nada.
 */
export function computeAvailability(input: AvailabilityInput): Interval[] {
  const { space, range } = input;
  const paso = space.slotMinutes;
  const duracion = Math.max(space.minBookingMinutes, paso);

  // Los tramos no tienen por qué empezar en hora redonda. Un espacio que abre 09:30 con
  // turnos de una hora arranca a las 9:30, y recorrer la ventana desde su borde saltearía
  // TODOS sus turnos. Por eso se recorre una vez por cada desfasaje distinto que introducen
  // los tramos declarados.
  const minutoInicial = localMoment(range.startAt, input.timeZone).minuteOfDay;
  const desfasajes = new Set<number>();
  for (const h of input.weeklyHours) {
    desfasajes.add((((h.startMinute - minutoInicial) % paso) + paso) % paso);
  }
  if (desfasajes.size === 0) desfasajes.add(0);

  // Tope de seguridad: una grilla mal configurada no puede colgar el servidor.
  const maximo = 20_000;
  let vueltas = 0;

  const porComienzo = new Map<number, Interval>();
  for (const desfasaje of desfasajes) {
    let cursor = addMinutes(range.startAt, desfasaje);
    while (cursor.getTime() < range.endAt.getTime() && vueltas < maximo) {
      vueltas += 1;
      const candidato = { startAt: cursor, endAt: addMinutes(cursor, duracion) };
      if (checkRange(candidato, input).ok) porComienzo.set(cursor.getTime(), candidato);
      cursor = addMinutes(cursor, paso);
    }
  }

  return [...porComienzo.values()].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

const MOTIVOS: Record<BookingRejection, string> = {
  FUERA_DE_HORARIO: "Ese horario está fuera de los días y horas en que el espacio se alquila.",
  OCUPADO: "Ese horario se acaba de ocupar. Elegí otro.",
  CERRADO: "La institución está cerrada en esa fecha.",
  MUY_SOBRE_LA_HORA: "Falta muy poco para ese horario. Elegí uno con más anticipación.",
  DEMASIADO_LEJOS: "Todavía no se puede reservar con tanta anticipación.",
  DURACION_INVALIDA: "Esa duración no está permitida para este espacio.",
  FUERA_DE_GRILLA: "Ese horario no arranca donde arrancan los turnos de este espacio.",
  RANGO_INVALIDO: "El horario de fin tiene que ser posterior al de inicio.",
};

export function rejectionMessage(reason: BookingRejection): string {
  return MOTIVOS[reason];
}
