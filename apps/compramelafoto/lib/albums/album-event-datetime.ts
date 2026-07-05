/**
 * Fecha y horario de evento en álbumes (eventDate, startsAt, endsAt).
 * Timezone fija: America/Argentina/Buenos_Aires (sin DST desde 2009 → UTC-3).
 */

export const ALBUM_EVENT_SCHEDULE_TZ = "America/Argentina/Buenos_Aires" as const;

/** Offset fijo AR; equivalente a America/Argentina/Buenos_Aires para instants actuales. */
const ARGENTINA_UTC_OFFSET = "-03:00";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type AlbumEventScheduleInput = {
  eventDate?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
};

export type AlbumEventSchedulePersisted = {
  eventDate: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type AlbumEventScheduleForm = {
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  displayLabel: string;
};

export type AlbumEventScheduleDb = {
  eventDate?: Date | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export type ValidateAlbumEventScheduleResult =
  | { ok: true }
  | { ok: false; error: string };

function trimOrEmpty(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidCalendarDate(dateStr: string): boolean {
  if (!DATE_RE.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

function isValidTime(timeStr: string): boolean {
  return TIME_RE.test(timeStr);
}

/** Medianoche ART del día → instante UTC. */
export function artStartOfDayUtc(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00${ARGENTINA_UTC_OFFSET}`);
  if (isNaN(d.getTime())) {
    throw new Error(`Fecha inválida: ${dateStr}`);
  }
  return d;
}

/** Último instante del día civil ART (23:59:59.999). Solo para matching; no persistir. */
export function artEndOfDayUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const probe = new Date(Date.UTC(y, m - 1, d + 1));
  const nextDateStr = [
    probe.getUTCFullYear(),
    String(probe.getUTCMonth() + 1).padStart(2, "0"),
    String(probe.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return new Date(artStartOfDayUtc(nextDateStr).getTime() - 1);
}

/** Fecha + hora local ART → instante UTC. */
export function artLocalDateTimeToUtc(dateStr: string, timeStr: string): Date {
  const d = new Date(`${dateStr}T${timeStr}:00${ARGENTINA_UTC_OFFSET}`);
  if (isNaN(d.getTime())) {
    throw new Error(`Fecha u hora inválida: ${dateStr} ${timeStr}`);
  }
  return d;
}

function formatDateYmdInArt(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ALBUM_EVENT_SCHEDULE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function formatTimeHmInArt(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ALBUM_EVENT_SCHEDULE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function formatDisplayDateInArt(instant: Date): string {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: ALBUM_EVENT_SCHEDULE_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(instant);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = (parts.find((p) => p.type === "month")?.value ?? "").replace(/\.$/, "");
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${day} ${month} ${year}`.trim();
}

export function validateAlbumEventSchedule(
  input: AlbumEventScheduleInput
): ValidateAlbumEventScheduleResult {
  const eventDate = trimOrEmpty(input.eventDate);
  const eventStartTime = trimOrEmpty(input.eventStartTime);
  const eventEndTime = trimOrEmpty(input.eventEndTime);

  if ((eventStartTime || eventEndTime) && !eventDate) {
    return { ok: false, error: "Indicá la fecha del evento antes de las horas." };
  }

  if (eventDate && !isValidCalendarDate(eventDate)) {
    return { ok: false, error: "La fecha del evento no es válida." };
  }

  if (eventStartTime && !isValidTime(eventStartTime)) {
    return { ok: false, error: "La hora de inicio no es válida." };
  }

  if (eventEndTime && !isValidTime(eventEndTime)) {
    return { ok: false, error: "La hora de finalización no es válida." };
  }

  if (eventDate && eventStartTime && eventEndTime) {
    const startsAt = artLocalDateTimeToUtc(eventDate, eventStartTime);
    const endsAt = artLocalDateTimeToUtc(eventDate, eventEndTime);
    if (endsAt.getTime() <= startsAt.getTime()) {
      return {
        ok: false,
        error: "La hora de finalización debe ser posterior a la hora de inicio.",
      };
    }
  }

  return { ok: true };
}

/**
 * Convierte input del cliente a valores para persistir.
 * Solo fecha → eventDate con startsAt/endsAt null (sin ventana de día completo).
 */
export function parseAlbumEventScheduleInput(
  input: AlbumEventScheduleInput
): AlbumEventSchedulePersisted {
  const validation = validateAlbumEventSchedule(input);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const eventDateStr = trimOrEmpty(input.eventDate);
  const eventStartTime = trimOrEmpty(input.eventStartTime);
  const eventEndTime = trimOrEmpty(input.eventEndTime);

  if (!eventDateStr) {
    return { eventDate: null, startsAt: null, endsAt: null };
  }

  const eventDate = artStartOfDayUtc(eventDateStr);
  const startsAt = eventStartTime
    ? artLocalDateTimeToUtc(eventDateStr, eventStartTime)
    : null;
  const endsAt = eventEndTime ? artLocalDateTimeToUtc(eventDateStr, eventEndTime) : null;

  return { eventDate, startsAt, endsAt };
}

/** Hidrata formulario desde DB. Prioridad: startsAt > eventDate. */
export function buildAlbumEventScheduleFromDb(
  row: AlbumEventScheduleDb
): AlbumEventScheduleForm {
  const startsAt = row.startsAt ?? null;
  const endsAt = row.endsAt ?? null;
  const legacyEventDate = row.eventDate ?? null;

  let eventDate = "";
  let eventStartTime = "";
  let eventEndTime = "";

  if (startsAt) {
    eventDate = formatDateYmdInArt(startsAt);
    eventStartTime = formatTimeHmInArt(startsAt);
    if (endsAt) {
      eventEndTime = formatTimeHmInArt(endsAt);
    }
  } else if (legacyEventDate) {
    eventDate = formatDateYmdInArt(legacyEventDate);
  }

  const displayLabel = formatAlbumEventScheduleDisplay({
    eventDate,
    eventStartTime,
    eventEndTime,
    startsAt,
    endsAt,
  });

  return { eventDate, eventStartTime, eventEndTime, displayLabel };
}

export function formatAlbumEventScheduleDisplay(params: {
  eventDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
}): string {
  const eventDate = trimOrEmpty(params.eventDate);
  const eventStartTime = trimOrEmpty(params.eventStartTime);
  const eventEndTime = trimOrEmpty(params.eventEndTime);

  let anchor: Date | null = params.startsAt ?? null;
  if (!anchor && eventDate && isValidCalendarDate(eventDate)) {
    anchor = artStartOfDayUtc(eventDate);
  }
  if (!anchor) {
    return "";
  }

  const dateLabel = formatDisplayDateInArt(anchor);
  const startLabel =
    eventStartTime || (params.startsAt ? formatTimeHmInArt(params.startsAt) : "");
  const endLabel = eventEndTime || (params.endsAt ? formatTimeHmInArt(params.endsAt) : "");

  if (startLabel && endLabel) {
    return `${dateLabel} · ${startLabel} – ${endLabel}`;
  }

  return dateLabel;
}
