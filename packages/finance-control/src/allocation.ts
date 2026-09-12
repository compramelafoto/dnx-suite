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
  for (const parte of shares) {
    if (parte.sharePercent < 0 || parte.sharePercent > 100) {
      throw new Error(
        `El reparto de "${parte.platformKey}" es ${parte.sharePercent}% y tiene que estar entre 0% y 100%.`,
      );
    }
  }

  const suma = shares.reduce((total, parte) => total + parte.sharePercent, 0);
  const sumaRedondeada = Math.round(suma * 100) / 100;
  if (Math.abs(sumaRedondeada - 100) >= 1e-9) {
    throw new Error(`El reparto suma ${suma}% y tiene que sumar exactamente 100%.`);
  }
}

type Fila = {
  platformKey: string;
  sharePercent: number;
  monto: number;
  resto: number;
};

export function splitAmountByAllocation(
  amountArsMinor: number,
  shares: AllocationShare[],
): AllocatedAmount[] {
  assertSharesSumTo100(shares);

  // Cada fila es un objeto mutable: repartir centavos después significa
  // sumarle 1 a `monto` directamente sobre la fila, nunca indexar un
  // arreglo con una posición calculada (eso es lo que TypeScript no puede
  // probar que sea válida bajo `noUncheckedIndexedAccess`).
  const filas: Fila[] = shares.map((parte) => {
    const exacto = (amountArsMinor * parte.sharePercent) / 100;
    const piso = Math.floor(exacto);
    return {
      platformKey: parte.platformKey,
      sharePercent: parte.sharePercent,
      monto: piso,
      resto: exacto - piso,
    };
  });

  const asignado = filas.reduce((total, fila) => total + fila.monto, 0);
  const sobrantes = Math.round(amountArsMinor - asignado);

  // Orden de filas por resto descendente: a quienes más perdieron al
  // redondear para abajo se les da (o se les quita, si sobrantes es
  // negativo) primero.
  const ordenPorResto = [...filas].sort((a, b) => b.resto - a.resto);

  // Se reparte (o se retira) un centavo por vuelta, ciclando tantas veces
  // como haga falta. Esto sostiene la garantía "las partes siempre suman
  // el total" aunque sobrantes supere la cantidad de plataformas, o sea
  // negativo (validación que en teoría no debería fallar, pero esta
  // función no depende de eso).
  if (sobrantes > 0) {
    repartirCiclando(ordenPorResto, sobrantes, 1);
  } else if (sobrantes < 0) {
    // Para quitar, se cicla desde el final: a quienes menos les
    // correspondía (resto más chico) se les quita primero.
    repartirCiclando([...ordenPorResto].reverse(), -sobrantes, -1);
  }

  return filas.map((fila) => ({
    platformKey: fila.platformKey,
    sharePercent: fila.sharePercent,
    amountArsMinor: fila.monto,
  }));
}

/**
 * Suma (o resta) 1 centavo a cada fila, ciclando por `filas` en orden tantas
 * veces como haga falta hasta agotar `vueltas`. Usa `for...of` a propósito:
 * así cada `fila` llega con su tipo garantizado, sin pasar por un índice
 * numérico que pueda estar fuera de rango.
 */
function repartirCiclando(filas: Fila[], vueltas: number, incremento: 1 | -1): void {
  let quedan = vueltas;
  while (quedan > 0) {
    for (const fila of filas) {
      if (quedan === 0) break;
      fila.monto += incremento;
      quedan -= 1;
    }
  }
}
