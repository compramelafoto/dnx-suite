/**
 * La parte de cada turno que le corresponde a quien atiende, y su liquidación. Módulo PURO.
 *
 * El caso es una barbería: los barberos le alquilan el lugar a la institución y se llevan un
 * porcentaje de cada turno (corte y extras). La parte se congela en la reserva al crearla; la
 * liquidación junta lo que todavía se le debe a cada uno por los turnos que ya pasaron.
 */

/** "60" o "60,5" → 6000 o 6050 centésimos de punto. Vacío = 0. Fuera de 0–100 o ilegible = null. */
export function parseSharePercent(raw: string | null | undefined): number | null {
  const texto = (raw ?? "").trim().replace("%", "").replace(",", ".");
  if (texto === "") return 0;
  const n = Number(texto);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100);
}

/** 6000 → "60 %"; 6050 → "60,5 %". */
export function shareLabel(bps: number): string {
  const pct = bps / 100;
  const texto = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0+$/, "").replace(".", ",");
  return `${texto} %`;
}

/** La parte del profesional sobre un total, en centavos. Se redondea al centavo. */
export function professionalShareMinor(totalMinor: number, shareBps: number): number {
  if (!Number.isFinite(totalMinor) || totalMinor <= 0) return 0;
  if (!Number.isFinite(shareBps) || shareBps <= 0) return 0;
  const bps = Math.min(10_000, Math.floor(shareBps));
  return Math.round((totalMinor * bps) / 10_000);
}

export type PendingTurn = {
  id: string;
  startAt: Date;
  endAt: Date;
  shareMinor: number;
};

export type PendingSummary = {
  count: number;
  totalMinor: number;
  fromAt: Date | null;
  toAt: Date | null;
};

/**
 * Lo que se le debe a un profesional: los turnos que ya terminaron, siguen en pie y todavía no
 * entraron en ninguna liquidación. Los turnos futuros no se pagan: el corte todavía no se hizo.
 */
export function summarizePending(turns: PendingTurn[], now: Date): PendingSummary {
  const hechos = turns.filter((t) => t.endAt.getTime() <= now.getTime() && t.shareMinor > 0);
  if (hechos.length === 0) return { count: 0, totalMinor: 0, fromAt: null, toAt: null };
  const ordenados = [...hechos].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return {
    count: hechos.length,
    totalMinor: hechos.reduce((s, t) => s + t.shareMinor, 0),
    fromAt: ordenados[0]!.startAt,
    toAt: ordenados[ordenados.length - 1]!.endAt,
  };
}
