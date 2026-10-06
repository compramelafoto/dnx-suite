/**
 * El próximo número de venta. Módulo PURO: recibe el último y decide.
 *
 * Mismo criterio que `nextClientNumber` en `lib/clients/client-number.ts`: no se reutilizan
 * huecos —si la venta 33 se anula, el 33 no vuelve— porque un número de venta que nombra a
 * dos tickets distintos a lo largo del tiempo rompe cualquier comprobante viejo que lo
 * mencione.
 *
 * La condición de carrera —dos ventas simultáneas pidiendo el mismo número— NO se resuelve
 * acá: la resuelve el índice único `(workspaceId, saleNumber)` de la base, y quien llama
 * reintenta. Ver `lib/sales/record-sale.ts`.
 */
export function nextSaleNumber(lastNumber: number | null): number {
  if (lastNumber === null || lastNumber < 1) return 1;
  return Math.floor(lastNumber) + 1;
}
