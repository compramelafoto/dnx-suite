import { KNOWN_FORMATTERS, type KnownFormatter } from "../core/constants";
import {
  formatDateDayMonthUppercase,
  formatDateLong,
  formatDateLongUppercase,
  formatDateShort,
  formatParticipantNumber,
} from "./date-format";

export function isKnownFormatter(name: string | undefined | null): name is KnownFormatter {
  if (!name) return false;
  return (KNOWN_FORMATTERS as readonly string[]).includes(name);
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Aplica formatter conocido. Formatters desconocidos se reportan aparte (no se aplican).
 */
export function applyFormatter(
  value: unknown,
  formatter: string | undefined
): { text: string; unknownFormatter: boolean } {
  const text = value == null ? "" : String(value);
  const name = formatter && formatter !== "none" ? formatter : "none";

  if (name === "none") {
    return { text, unknownFormatter: false };
  }

  if (!isKnownFormatter(name)) {
    return { text, unknownFormatter: true };
  }

  switch (name) {
    case "uppercase":
      return { text: text.toUpperCase(), unknownFormatter: false };
    case "titleCase":
      return { text: toTitleCase(text), unknownFormatter: false };
    case "truncate": {
      const max = 80;
      return {
        text: text.length > max ? `${text.slice(0, max - 1)}…` : text,
        unknownFormatter: false,
      };
    }
    case "date.short":
      return { text: formatDateShort(value), unknownFormatter: false };
    case "date.long":
      return { text: formatDateLong(value), unknownFormatter: false };
    case "date.longUppercase":
      return { text: formatDateLongUppercase(value), unknownFormatter: false };
    case "date.dayMonthUppercase":
      return { text: formatDateDayMonthUppercase(value), unknownFormatter: false };
    case "participantNumber":
      return { text: formatParticipantNumber(value, 4), unknownFormatter: false };
    default:
      return { text, unknownFormatter: false };
  }
}
