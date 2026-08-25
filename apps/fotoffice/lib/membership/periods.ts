export type DuePeriod = {
  /** `YYYY-MM`. Identifica el mes que la cuota cubre. */
  period: string;
  dueDate: Date;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Último día del mes, para no desbordar cuando el día de vencimiento no existe. */
function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/**
 * Arma el vencimiento de un período.
 *
 * Si el día configurado no existe en ese mes (30 en febrero) se topea al último día:
 * desbordar al mes siguiente sería cobrar tarde y descuadrar la racha de mora.
 *
 * Todo en UTC a propósito. Un vencimiento es una fecha calendaria, no un instante: si se
 * calculara en horario local, alguien en otro huso vería la cuota vencer un día distinto.
 */
export function monthlyDuePeriod(period: string, dueDay: number): DuePeriod {
  const [y, m] = period.split("-").map(Number);
  const year = y!;
  const month1 = m!;
  const day = Math.min(dueDay, lastDayOfMonth(year, month1));
  return { period, dueDate: new Date(Date.UTC(year, month1 - 1, day)) };
}

/**
 * Meses que cubren las cuotas de ingreso.
 *
 * Regla acordada: las cuotas cubren los meses **siguientes** al ingreso y el mes en curso
 * queda bonificado — salvo que la persona se asocie **antes del vencimiento**, en cuyo
 * caso alcanza a usar el mes entero y este cuenta como la primera.
 *
 * No se cobran proporcionales a propósito: una cuota societaria es una membresía, no un
 * servicio medido. Cobrar medio mes introduce decimales y discusiones para siempre a
 * cambio de una fracción de cuota.
 */
export function initialDuePeriods(input: {
  joinedAt: Date;
  count: number;
  dueDay: number;
  countJoinMonthIfBeforeDueDay: boolean;
}): DuePeriod[] {
  if (input.count <= 0) return [];

  const year = input.joinedAt.getUTCFullYear();
  const month1 = input.joinedAt.getUTCMonth() + 1;
  const day = input.joinedAt.getUTCDate();

  const empiezaEsteMes = input.countJoinMonthIfBeforeDueDay && day <= input.dueDay;
  let y = year;
  let m = empiezaEsteMes ? month1 : month1 + 1;
  if (m > 12) {
    m -= 12;
    y += 1;
  }

  const out: DuePeriod[] = [];
  for (let i = 0; i < input.count; i++) {
    out.push(monthlyDuePeriod(`${y}-${pad(m)}`, input.dueDay));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
