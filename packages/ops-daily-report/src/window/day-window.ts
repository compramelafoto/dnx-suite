/**
 * Resolución del día calendario argentino para el informe diario.
 *
 * El cron corre en UTC. Argentina es UTC-3 sin horario de verano desde 2009,
 * pero el offset se calcula con Intl en lugar de fijarlo a mano, para que un
 * cambio futuro de política horaria no rompa el informe en silencio.
 */

export const REPORT_TIME_ZONE = "America/Argentina/Buenos_Aires";

const MS_PER_DAY = 86_400_000;

export type DateRange = {
  start: Date;
  end: Date;
};

export type DayWindow = {
  /** Día informado en formato YYYY-MM-DD, calendario argentino. */
  reportDate: string;
  /** El día que acaba de terminar. */
  current: DateRange;
  /** El día anterior al informado, para comparar. */
  previous: DateRange;
  /** Los siete días previos al informado, para el promedio. */
  trailingSevenDays: DateRange;
  timeZone: string;
};

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(instant: Date): ZonedParts {
  const parts = partsFormatter.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    if (!found) {
      throw new Error(`No se pudo leer el componente horario "${type}".`);
    }
    return Number(found.value);
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/** Diferencia entre la hora argentina y UTC, en milisegundos (negativa para UTC-3). */
function zoneOffsetMs(instant: Date): number {
  const parts = zonedParts(instant);
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  // Se descartan los milisegundos del instante original: el offset siempre es
  // múltiplo de un minuto, así que no afectan el resultado.
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return asIfUtc - truncated;
}

/** Instante UTC correspondiente a la medianoche argentina de la fecha dada. */
function argentinaMidnight(year: number, month: number, day: number): Date {
  const naive = Date.UTC(year, month - 1, day);
  // Primera aproximación al mediodía local, lejos de cualquier salto horario,
  // para leer el offset correcto de esa fecha.
  const firstGuess = new Date(naive + 12 * 60 * 60 * 1000);
  const offset = zoneOffsetMs(firstGuess);
  return new Date(naive - offset);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function resolveArgentinaDayWindow(now: Date): DayWindow {
  if (Number.isNaN(now.getTime())) {
    throw new Error("resolveArgentinaDayWindow recibió una fecha inválida.");
  }

  const today = zonedParts(now);
  const todayMidnight = argentinaMidnight(today.year, today.month, today.day);

  // El día informado es el que terminó: desde su medianoche hasta la de hoy.
  const currentEnd = todayMidnight;
  const reportedDayParts = zonedParts(new Date(currentEnd.getTime() - MS_PER_DAY / 2));
  const currentStart = argentinaMidnight(
    reportedDayParts.year,
    reportedDayParts.month,
    reportedDayParts.day,
  );

  const previousDayParts = zonedParts(new Date(currentStart.getTime() - MS_PER_DAY / 2));
  const previousStart = argentinaMidnight(
    previousDayParts.year,
    previousDayParts.month,
    previousDayParts.day,
  );

  const sevenDaysAgoParts = zonedParts(
    new Date(currentStart.getTime() - 7 * MS_PER_DAY + MS_PER_DAY / 2),
  );
  const trailingStart = argentinaMidnight(
    sevenDaysAgoParts.year,
    sevenDaysAgoParts.month,
    sevenDaysAgoParts.day,
  );

  return {
    reportDate: `${reportedDayParts.year}-${pad(reportedDayParts.month)}-${pad(reportedDayParts.day)}`,
    current: { start: currentStart, end: currentEnd },
    previous: { start: previousStart, end: currentStart },
    trailingSevenDays: { start: trailingStart, end: currentStart },
    timeZone: REPORT_TIME_ZONE,
  };
}
