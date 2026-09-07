/**
 * Reglas de la bonificación por recomendar un colega.
 *
 * Módulo PURO: sin base y sin red. Acá vive lo que puede estar mal de formas caras —qué
 * cuota se bonifica, por cuánto, y cuándo se puede deshacer—, así que se verifica sin
 * montar nada.
 *
 * Todo en centavos enteros. Los importes viven en la base como `Decimal`; la conversión
 * pasa en el borde y de acá para adentro no hay coma flotante en la plata.
 */

import { APERTURA_PERIOD, isPrintedCardCharge } from "./charge-labels";

export type BenefitCharge = {
  id: string;
  concept: string;
  /** `YYYY-MM`, o una etiqueta reservada como `APERTURA` o `TARJETA`. */
  period: string;
  dueDate: Date;
  /** Valor original de la cuota, sobre el que se calcula el porcentaje. */
  amountMinor: number;
  /** Saldo pendiente. El descuento nunca puede superarlo. */
  balanceMinor: number;
};

export type BenefitStatus = "PENDIENTE" | "APLICADA" | "ANULADA";

/**
 * ¿Esta cuota puede recibir una bonificación?
 *
 * Sólo las mensuales impagas. El ingreso queda afuera porque el beneficio es sobre la cuota
 * y no sobre el alta; la credencial impresa, porque es un costo real que la institución paga
 * al imprentero; y el arrastre `APERTURA`, porque es deuda traída del sistema anterior y
 * bonificarla mezclaría el beneficio con una migración que ni siquiera reconcilia para todos.
 */
export function isBenefitEligibleCharge(charge: {
  concept: string;
  period: string;
  balanceMinor: number;
}): boolean {
  if (charge.concept !== "MENSUAL") return false;
  if (charge.period === APERTURA_PERIOD) return false;
  if (isPrintedCardCharge(charge.period)) return false;
  return charge.balanceMinor > 0;
}

/**
 * La cuota que recibe la bonificación: la impaga más antigua que todavía no tenga una.
 *
 * **Una bonificación por cuota.** Dos recomendados al 50% dan dos cuotas a mitad de precio,
 * no una gratis: acumularlas obligaría a explicar un saldo compuesto que nadie pidió.
 *
 * Devuelve `null` cuando no hay ninguna elegible. Eso no es un error: la bonificación queda
 * pendiente y se aplica sola sobre la cuota del mes siguiente.
 */
export function pickChargeForBenefit(
  charges: BenefitCharge[],
  excludeChargeIds: readonly string[],
): BenefitCharge | null {
  const excluidos = new Set(excludeChargeIds);
  const elegibles = charges
    .filter((c) => isBenefitEligibleCharge(c) && !excluidos.has(c.id))
    // Por vencimiento y, a igual vencimiento, por período: dos cargos del mismo día tienen
    // que quedar en un orden estable o dos ejecuciones elegirían cuotas distintas.
    .sort((a, b) => {
      const porFecha = a.dueDate.getTime() - b.dueDate.getTime();
      if (porFecha !== 0) return porFecha;
      return a.period.localeCompare(b.period);
    });
  return elegibles[0] ?? null;
}

/**
 * Cuánto se descuenta.
 *
 * El porcentaje se aplica sobre el valor original de la cuota y se acota al saldo pendiente:
 * una cuota pagada a medias se bonifica hasta lo que falta y ni un centavo más. El
 * beneficio nunca genera saldo a favor, porque saldo a favor es dinero, y esto no lo es.
 *
 * Redondeo hacia abajo, en contra del descuento: ante medio centavo en disputa, la
 * diferencia queda del lado de la institución.
 */
export function benefitDiscountMinor(input: {
  amountMinor: number;
  balanceMinor: number;
  percent: number;
}): number {
  if (input.percent <= 0 || input.amountMinor <= 0 || input.balanceMinor <= 0) return 0;
  // El porcentaje admite dos decimales; se lleva a entero antes de multiplicar para no
  // arrastrar el error de la coma flotante hasta los centavos.
  const puntos = Math.round(input.percent * 100);
  const bruto = Math.floor((input.amountMinor * puntos) / 10000);
  return Math.max(0, Math.min(bruto, input.balanceMinor));
}

/**
 * ¿Se puede anular esta bonificación?
 *
 * Anular una aplicada a una cuota **ya pagada** convertiría a un socio al día en deudor de
 * algo que ya pagó. Eso no se hace: si hubo un error, se corrige por fuera, con un ajuste
 * que quede explicado.
 */
export function canVoidBenefit(input: {
  status: BenefitStatus;
  /** Saldo actual de la cuota bonificada. `null` si todavía no se aplicó a ninguna. */
  appliedChargeBalanceMinor: number | null;
}): { ok: true } | { ok: false; reason: string } {
  if (input.status === "ANULADA") {
    return { ok: false, reason: "Esta bonificación ya estaba anulada." };
  }
  if (input.status === "PENDIENTE") return { ok: true };
  if ((input.appliedChargeBalanceMinor ?? 0) <= 0) {
    return {
      ok: false,
      reason:
        "La cuota bonificada ya fue pagada: anularla dejaría al socio debiendo algo que ya abonó.",
    };
  }
  return { ok: true };
}

/**
 * ¿Corresponde acreditar una bonificación por este socio nuevo?
 *
 * Las seis condiciones juntas, en un solo lugar y sin base de por medio, para que se puedan
 * verificar de a una.
 */
export function shouldAwardBenefit(input: {
  enabled: boolean;
  percent: number;
  recommenderMemberId: string | null;
  recommenderStatus: string | null;
  newMemberId: string;
  alreadyAwarded: boolean;
}): { award: true; percent: number } | { award: false; reason: string } {
  if (!input.enabled) return { award: false, reason: "El módulo de recomendaciones está apagado." };
  if (input.percent <= 0) return { award: false, reason: "El beneficio configurado es de cero." };
  if (!input.recommenderMemberId) {
    return { award: false, reason: "El socio no llegó por una recomendación." };
  }
  if (input.recommenderMemberId === input.newMemberId) {
    return { award: false, reason: "Nadie se recomienda a sí mismo." };
  }
  if (input.recommenderStatus !== "ACTIVE") {
    return { award: false, reason: "Quien lo recomendó ya no es socio activo." };
  }
  if (input.alreadyAwarded) return { award: false, reason: "Este alta ya otorgó su bonificación." };
  return { award: true, percent: input.percent };
}
