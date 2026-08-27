/**
 * Reglas para cargar un valor de cuota.
 *
 * Función pura: el importe de la cuota es lo que después se le cobra a 152 personas, así que
 * la validación tiene que poder probarse sin base de datos.
 */

export type FeeValueInput = {
  /** Texto tal como lo escribió la persona. Se acepta coma o punto. */
  amountRaw: string;
  /** `AAAA-MM-DD`. Desde cuándo rige. */
  validFromRaw: string;
  categoryId: string | null;
  boardMinutesRef: string | null;
};

export type FeeValueParsed = {
  amountMinor: number;
  validFrom: Date;
  categoryId: string | null;
  boardMinutesRef: string | null;
};

export type FeeValueResult =
  | { ok: true; value: FeeValueParsed }
  | { ok: false; error: string };

/** Tope de cordura: una cuota de más de diez millones es un error de tipeo, no una decisión. */
export const MAX_FEE_MINOR = 10_000_000_00;

export function parseFeeValue(input: FeeValueInput): FeeValueResult {
  const texto = input.amountRaw.trim().replace(/\./g, "").replace(",", ".");
  if (!texto) return { ok: false, error: "Escribí el importe de la cuota." };
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
    return { ok: false, error: "El importe tiene que ser un número, con hasta dos decimales." };
  }

  const [entera = "0", decimal = ""] = texto.split(".");
  const amountMinor = Number(entera) * 100 + Number(`${decimal}00`.slice(0, 2));
  if (amountMinor <= 0) return { ok: false, error: "El importe tiene que ser mayor que cero." };
  if (amountMinor > MAX_FEE_MINOR) {
    return { ok: false, error: "Ese importe parece un error de tipeo. Revisalo." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.validFromRaw.trim())) {
    return { ok: false, error: "Elegí desde cuándo rige el valor." };
  }
  const validFrom = new Date(`${input.validFromRaw.trim()}T00:00:00.000Z`);
  if (Number.isNaN(validFrom.getTime())) {
    return { ok: false, error: "La fecha no es válida." };
  }

  return {
    ok: true,
    value: {
      amountMinor,
      validFrom,
      categoryId: input.categoryId?.trim() || null,
      boardMinutesRef: input.boardMinutesRef?.trim() || null,
    },
  };
}

/**
 * Los días del mes que la institución configura.
 *
 * Se limitan a 28 a propósito: un día 30 dejaría a febrero sin generación de cuotas, y un
 * día 31 la dejaría afuera siete meses del año.
 */
export const MAX_DAY_OF_MONTH = 28;

export type DuesSettingsInput = {
  generationDay: number;
  dueDay: number;
  graceDays: number;
  reminderDay: number;
  initialDuesCount: number;
};

export function validateDuesSettings(input: DuesSettingsInput): { ok: true } | { ok: false; error: string } {
  const dias: Array<[keyof DuesSettingsInput, string]> = [
    ["generationDay", "El día de generación"],
    ["dueDay", "El día de vencimiento"],
    ["reminderDay", "El día del recordatorio"],
  ];
  for (const [campo, etiqueta] of dias) {
    const v = input[campo];
    if (!Number.isInteger(v) || v < 1 || v > MAX_DAY_OF_MONTH) {
      return { ok: false, error: `${etiqueta} tiene que estar entre 1 y ${MAX_DAY_OF_MONTH}.` };
    }
  }
  if (!Number.isInteger(input.graceDays) || input.graceDays < 0 || input.graceDays > 60) {
    return { ok: false, error: "Los días de gracia tienen que estar entre 0 y 60." };
  }
  if (!Number.isInteger(input.initialDuesCount) || input.initialDuesCount < 0 || input.initialDuesCount > 12) {
    return { ok: false, error: "Las cuotas de ingreso tienen que estar entre 0 y 12." };
  }
  if (input.generationDay > input.dueDay) {
    // Generar la cuota después de su propio vencimiento la dejaría vencida el día que nace.
    return { ok: false, error: "La cuota no puede generarse después de su vencimiento." };
  }
  return { ok: true };
}
