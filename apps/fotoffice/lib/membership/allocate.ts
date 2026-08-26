import { sortOldestFirst, type OpenCharge } from "./select-charges";

/**
 * Repartir un pago entre los cargos abiertos.
 *
 * Se calcula **en el momento de acreditar**, no al iniciar el pago, y a propósito: entre que
 * el socio arranca el checkout y MercadoPago avisa pueden pasar días, y en el medio la
 * Secretaría puede haber registrado un pago en efectivo o haberse generado la cuota del mes.
 * Repartir contra la deuda real de ese instante es lo único que no deja plata mal imputada.
 */

export type Allocation = {
  chargeId: string;
  /** Cuánto de este pago se imputa a este cargo, en centavos. */
  principalMinor: number;
  /** Saldo que le queda al cargo después de imputar. */
  remainingMinor: number;
};

export type AllocationPlan = {
  allocations: Allocation[];
  /**
   * Lo que sobró y no se pudo imputar a ningún cargo, en centavos. Queda a favor del socio:
   * no se descarta ni se devuelve por cuenta propia.
   */
  unappliedMinor: number;
};

export function allocatePayment(input: {
  amountMinor: number;
  charges: OpenCharge[];
}): AllocationPlan {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { allocations: [], unappliedMinor: 0 };
  }

  const ordenados = sortOldestFirst(input.charges.filter((c) => c.balanceMinor > 0));
  const allocations: Allocation[] = [];
  let restante = input.amountMinor;

  for (const cargo of ordenados) {
    if (restante <= 0) break;
    const imputado = Math.min(restante, cargo.balanceMinor);
    allocations.push({
      chargeId: cargo.id,
      principalMinor: imputado,
      remainingMinor: cargo.balanceMinor - imputado,
    });
    restante -= imputado;
  }

  return { allocations, unappliedMinor: restante };
}

/**
 * Lo que tiene que valer siempre: cada centavo del pago está imputado o está declarado como
 * sobrante. Se usa en las pruebas y en la transacción de acreditación, como red.
 */
export function allocationBalances(plan: AllocationPlan, amountMinor: number): boolean {
  const imputado = plan.allocations.reduce((s, a) => s + a.principalMinor, 0);
  return imputado + plan.unappliedMinor === amountMinor;
}
