/**
 * Cuánto ahorra un pack combinado frente a comprar sus partes sueltas.
 *
 * Un pack "suelto" es el que trae un único beneficio. Si cada beneficio del
 * combo existe como pack suelto, la suma de esos sueltos es el precio de
 * referencia y la diferencia es el ahorro.
 *
 * Es deliberadamente conservador: si falta una sola parte no devuelve nada.
 * Preferimos no mostrar cartel antes que mostrarle al padre un ahorro inventado.
 */

export type PackForSavings = {
  price: number;
  benefits: { line: string }[];
};

export function packSavingsArs<T extends PackForSavings>(
  pack: T,
  allPacks: readonly T[]
): number | null {
  if (pack.benefits.length < 2) return null;

  /** Precio del pack suelto más barato que entrega exactamente ese beneficio. */
  const cheapestAlone = new Map<string, number>();
  for (const candidate of allPacks) {
    if (candidate === pack) continue;
    if (candidate.benefits.length !== 1) continue;
    const line = candidate.benefits[0].line;
    const current = cheapestAlone.get(line);
    if (current === undefined || candidate.price < current) {
      cheapestAlone.set(line, candidate.price);
    }
  }

  let separado = 0;
  for (const benefit of pack.benefits) {
    const suelto = cheapestAlone.get(benefit.line);
    if (suelto === undefined) return null;
    separado += suelto;
  }

  const ahorro = separado - pack.price;
  return ahorro > 0 ? ahorro : null;
}
