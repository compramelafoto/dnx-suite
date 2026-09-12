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

/** Tolerancia para comparar porcentajes cargados a mano con dos decimales. */
const TOLERANCIA = 0.005;

export function assertSharesSumTo100(shares: AllocationShare[]): void {
  const suma = shares.reduce((total, parte) => total + parte.sharePercent, 0);
  if (Math.abs(suma - 100) > TOLERANCIA) {
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

  const porRestoDescendente = exactos
    .map((exacto, indice) => ({ indice, resto: exacto - Math.floor(exacto) }))
    .sort((a, b) => b.resto - a.resto);

  const montos = [...pisos];
  for (const { indice } of porRestoDescendente) {
    if (sobrantes <= 0) break;
    montos[indice] += 1;
    sobrantes -= 1;
  }

  return shares.map((parte, indice) => ({
    platformKey: parte.platformKey,
    sharePercent: parte.sharePercent,
    amountArsMinor: montos[indice],
  }));
}
