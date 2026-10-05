/** Centavos a pesos argentinos, sin decimales: "$ 105.000". */
export function pesos(centavos: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(centavos / 100);
}
