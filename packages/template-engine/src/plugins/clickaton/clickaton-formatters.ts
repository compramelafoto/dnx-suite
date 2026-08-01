/**
 * Re-export de formatters de fecha/número usados por Clickatón.
 * La aplicación real ocurre en el core (`applyFormatter`).
 */
export {
  CLICKATON_DEFAULT_TIMEZONE,
  formatDateDayMonthUppercase,
  formatDateLong,
  formatDateLongUppercase,
  formatDateShort,
  formatParticipantNumber,
  toZonedCalendarParts,
} from "../../variables/date-format";

export const CLICKATON_FORMATTER_NAMES = [
  "date.short",
  "date.long",
  "date.longUppercase",
  "date.dayMonthUppercase",
  "participantNumber",
  "none",
  "uppercase",
  "titleCase",
  "truncate",
] as const;
