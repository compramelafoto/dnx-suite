import { foldQuoteText } from "./fold.js";
import {
  FULL_DAY_HOURS,
  HALF_DAY_HOURS,
  MAX_DURATION_HOURS,
  MIN_DURATION_HOURS,
} from "./models.js";

export type ExtractDurationResult = {
  durationHours?: number;
  warnings: string[];
};

const WORD_NUMBERS: Record<string, number> = {
  una: 1,
  un: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};

function sanitizeHours(value: number, warnings: string[]): number | undefined {
  if (!Number.isFinite(value) || value < MIN_DURATION_HOURS) {
    warnings.push("INVALID_DURATION");
    return undefined;
  }
  if (value > MAX_DURATION_HOURS) {
    warnings.push("DURATION_TOO_LONG");
    return undefined;
  }
  return value;
}

/**
 * Extrae duración del servicio. No interpreta "a las 20 horas" como duración.
 */
export function extractDurationHours(normalizedText: string): ExtractDurationResult {
  const warnings: string[] = [];
  const folded = foldQuoteText(normalizedText);

  if (/\bmedia\s+jornada\b/.test(folded)) {
    return { durationHours: HALF_DAY_HOURS, warnings };
  }
  if (/\bjornada\s+completa\b/.test(folded)) {
    return { durationHours: FULL_DAY_HOURS, warnings };
  }

  // Excluir horarios: "a las 20", "a la(s) 20 horas"
  const withoutClock = folded
    .replace(/\ba\s+las?\s+\d{1,2}(:\d{2})?\s*(hs|horas?|h)?\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ");

  // Rango aproximado: "entre seis y ocho horas" → toma el techo
  const rangeWord = withoutClock.match(
    /\bentre\s+(una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+y\s+(una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s*(hs|horas?|oras|h)\b/,
  );
  if (rangeWord?.[1] && rangeWord[2]) {
    const a = WORD_NUMBERS[rangeWord[1]];
    const b = WORD_NUMBERS[rangeWord[2]];
    if (a !== undefined && b !== undefined) {
      const hours = sanitizeHours(Math.max(a, b), warnings);
      if (hours !== undefined) {
        warnings.push("APPROXIMATE_DURATION_RANGE");
        return { durationHours: hours, warnings };
      }
    }
  }

  const rangeNum = withoutClock.match(
    /\bentre\s+(\d{1,2})\s+y\s+(\d{1,2})\s*(hs|horas?|oras|h)\b/,
  );
  if (rangeNum?.[1] && rangeNum[2]) {
    const hours = sanitizeHours(
      Math.max(Number(rangeNum[1]), Number(rangeNum[2])),
      warnings,
    );
    if (hours !== undefined) {
      warnings.push("APPROXIMATE_DURATION_RANGE");
      return { durationHours: hours, warnings };
    }
  }

  // "oras" = typo frecuente de "horas"
  const numeric = withoutClock.match(
    /\b(?:por|durante|de|unas?|como|alrededor\s+de)?\s*(\d{1,2})\s*(hs|horas?|oras|h)\b/,
  );
  if (numeric?.[1]) {
    const hours = sanitizeHours(Number(numeric[1]), warnings);
    if (hours !== undefined) return { durationHours: hours, warnings };
    return { warnings };
  }

  const worded = withoutClock.match(
    /\b(?:por|durante|de|unas?)?\s*(una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s*(hs|horas?|oras|h)\b/,
  );
  if (worded?.[1]) {
    const n = WORD_NUMBERS[worded[1]];
    if (n !== undefined) {
      const hours = sanitizeHours(n, warnings);
      if (hours !== undefined) return { durationHours: hours, warnings };
    }
    return { warnings };
  }

  return { warnings };
}
