/**
 * Reparto de un gasto entre plataformas.
 *
 * Usa el método del resto mayor: reparte la parte entera de cada porcentaje y
 * después entrega los centavos sobrantes a quienes tengan el resto más grande.
 * Así la suma de las partes es SIEMPRE igual al total.
 */

export type AllocationShare = {
  platformKey: string;
  sharePercent: number;
};

export type AllocatedAmount = AllocationShare & {
  amountArsMinor: number;
};

/**
 * El reparto tiene que sumar EXACTAMENTE 100% (así lo pide la spec). El
 * redondeo a dos decimales sólo absorbe el ruido de punto flotante de sumar
 * porcentajes que ya tienen a lo sumo dos decimales (ej. 33.33 + 33.33 +
 * 33.34) — no perdona repartos que en realidad no cierran en 100, como
 * 50.0025 + 50.0025 = 100.005.
 */
export function assertSharesSumTo100(shares: AllocationShare[]): void {
  const suma = shares.reduce((total, parte) => total + parte.sharePercent, 0);
  const sumaRedondeada = Math.round(suma * 100) / 100;
  if (Math.abs(sumaRedondeada - 100) >= 1e-9) {
    throw new Error(`El reparto suma ${suma}% y tiene que sumar exactamente 100%.`);
  }
}

export function splitAmountByAllocation(
  amountArsMinor: number,
  shares: AllocationShare[],
): AllocatedAmount[] {
  assertSharesSumTo100(shares);

  const exactos = shares.map((parte) => (amountArsMinor * parte.sharePercent) / 100);
  const pisos = exactos.map(Math.floor);
  const asignado = pisos.reduce((total, piso) => total + piso, 0);
  let sobrantes = Math.round(amountArsMinor - asignado);

  // Orden de índices por resto descendente: a quienes más perdieron al
  // redondear para abajo se les da (o se les quita, si sobrantes es
  // negativo) primero.
  const ordenPorResto = exactos
    .map((exacto, indice) => ({ indice, resto: exacto - Math.floor(exacto) }))
    .sort((a, b) => b.resto - a.resto)
    .map(({ indice }) => indice);

  const montos = [...pisos];

  // Se cicla por el orden de restos tantas veces como haga falta. Esto
  // sostiene la garantía "las partes siempre suman el total" aunque
  // sobrantes supere la cantidad de plataformas, o sea negativo (validación
  // que en teoría no debería fallar, pero esta función no depende de eso).
  let vuelta = 0;
  while (sobrantes > 0) {
    montos[ordenPorResto[vuelta % ordenPorResto.length]] += 1;
    sobrantes -= 1;
    vuelta += 1;
  }
  vuelta = 0;
  while (sobrantes < 0) {
    const indiceDesdeElFinal = ordenPorResto.length - 1 - (vuelta % ordenPorResto.length);
    montos[ordenPorResto[indiceDesdeElFinal]] -= 1;
    sobrantes += 1;
    vuelta += 1;
  }

  return shares.map((parte, indice) => ({
    platformKey: parte.platformKey,
    sharePercent: parte.sharePercent,
    amountArsMinor: montos[indice],
  }));
}
