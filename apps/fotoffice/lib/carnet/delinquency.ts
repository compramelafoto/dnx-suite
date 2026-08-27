/**
 * Situación de mora de un socio.
 *
 * Los umbrales —3 cuotas seguidas o 5 alternadas— son **estatutarios**, no una decisión de
 * producto. Quedan configurables porque otras instituciones tendrán los suyos, no porque
 * estén en discusión para la SFPR.
 *
 * Función pura: no lee la base ni el reloj más que por parámetro. La mora es el dato que
 * decide si un socio queda inhabilitado, así que tiene que poder probarse hasta el borde.
 */

export const DEFAULT_MAX_CONSECUTIVE = 3;
export const DEFAULT_MAX_ALTERNATING = 5;

export type DuesCharge = {
  concept: string;
  /** `YYYY-MM`. */
  period: string;
  /** Saldo pendiente en centavos. Cero = cancelada. */
  balanceMinor: number;
};

export type Delinquency = {
  /** Cuántas cuotas mensuales quedan impagas en total. */
  unpaidTotal: number;
  /** La racha de impagas seguidas más larga. */
  longestConsecutive: number;
  /** La racha que llega hasta el período más reciente. */
  currentConsecutive: number;
  delinquent: boolean;
  /**
   * Tiene cuotas de ingreso sin pagar.
   *
   * No es mora: el socio recién asociado no debe nada atrasado, todavía no pagó su
   * inscripción. Se distingue porque el carnet tiene que decir cosas distintas — "regularizá
   * tu deuda" y "completá tu inscripción" no son el mismo mensaje ni le caben a la misma
   * persona.
   */
  pendingEntry: boolean;
};

export type DelinquencyThresholds = {
  maxConsecutive?: number;
  maxAlternating?: number;
};

export function computeDelinquency(
  charges: DuesCharge[],
  umbrales: DelinquencyThresholds = {},
): Delinquency {
  const maxConsecutive = umbrales.maxConsecutive ?? DEFAULT_MAX_CONSECUTIVE;
  const maxAlternating = umbrales.maxAlternating ?? DEFAULT_MAX_ALTERNATING;

  // El ingreso se paga entero o no se pagó: una de las tres saldadas no habilita a nadie.
  const pendingEntry = charges.some((c) => c.concept === "INGRESO" && c.balanceMinor > 0);

  // Solo las mensuales integran la racha. Las de ingreso no: el socio recién asociado tiene
  // tres cargos abiertos por definición, y contarlas lo dejaría en mora el primer día. Su
  // situación se informa aparte, con `pendingEntry`.
  const mensuales = charges
    .filter((c) => c.concept === "MENSUAL")
    .sort((a, b) => a.period.localeCompare(b.period));

  let unpaidTotal = 0;
  let longestConsecutive = 0;
  let currentConsecutive = 0;
  let racha = 0;

  for (const cuota of mensuales) {
    // Un pago parcial NO corta la racha: la racha se mide sobre cargos con saldo cero.
    const impaga = cuota.balanceMinor > 0;
    if (impaga) {
      unpaidTotal += 1;
      racha += 1;
      if (racha > longestConsecutive) longestConsecutive = racha;
    } else {
      racha = 0;
    }
  }
  currentConsecutive = racha;

  return {
    unpaidTotal,
    longestConsecutive,
    currentConsecutive,
    delinquent: longestConsecutive >= maxConsecutive || unpaidTotal >= maxAlternating,
    pendingEntry,
  };
}
