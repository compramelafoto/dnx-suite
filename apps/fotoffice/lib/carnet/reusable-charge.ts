/**
 * ¿Hay un cargo de tarjeta ya pagado esperando que se emita la credencial?
 *
 * Aparece en dos situaciones que son la misma: el socio pagó su carnet y no lo tiene. Puede
 * ser porque lo abonó al asociarse y todavía no subió la foto, o porque la tarjeta se anuló
 * después de pagarla —salió mal la impresión, se perdió en el correo—. En los dos casos la
 * siguiente se engancha a ese cargo en vez de crear uno nuevo.
 *
 * Función pura: decide si se le cobra o no a una persona, así que tiene que poder probarse
 * sin base de datos.
 */

export type PrintOrderChargeCandidate = {
  id: string;
  /** Saldo pendiente en centavos. Cero o menos = pagado. */
  balanceMinor: number;
};

export function reusablePrintOrderCharge(input: {
  /** Cargos de tarjeta del socio, del más viejo al más nuevo. */
  charges: readonly PrintOrderChargeCandidate[];
  /** Cargos que ya están pagando una tarjeta que no se anuló. */
  takenChargeIds: readonly string[];
}): string | null {
  const tomados = new Set(input.takenChargeIds);
  const libre = input.charges.find((c) => c.balanceMinor <= 0 && !tomados.has(c.id));
  return libre?.id ?? null;
}
