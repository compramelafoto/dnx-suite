/** Centavos a pesos argentinos: "$ 105.000"; con centavos sólo si los hay: "$ 1.234,50". */
export function pesos(centavos: number): string {
  const conCentavos = Math.round(centavos) % 100 !== 0;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: conCentavos ? 2 : 0,
    maximumFractionDigits: conCentavos ? 2 : 0,
  }).format(centavos / 100);
}
