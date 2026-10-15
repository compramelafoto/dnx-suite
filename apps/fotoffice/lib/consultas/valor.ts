/**
 * Valor estimado de una consulta (spec §3.7). Módulo PURO: lo usan la lista (servidor) y el
 * tablero (cliente). El valor estimado no es plata cobrada: se ve con "Ver" en Consultas.
 */

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** "$ 1.250.000", sin decimales. */
export function formatoPesos(n: number): string {
  return pesos.format(n);
}

/** El `Decimal` de Prisma (o un número) como número; null si no hay valor o no es un número. */
export function valorComoNumero(v: { toString(): string } | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

/** Suma en centavos (sin errores de coma flotante); los vacíos no suman. */
export function sumarValores(valores: readonly (number | null)[]): number {
  let centavos = 0;
  for (const v of valores) if (v !== null) centavos += Math.round(v * 100);
  return centavos / 100;
}
