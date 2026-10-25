/**
 * Un proveedor puede tener varias facturas en un mes (las que llegan por mail traen número).
 * Lo que no puede haber son dos gastos sin número de factura para el mismo proveedor y mes:
 * eso es casi siempre una carga repetida (doble clic, o cargar dos veces lo mismo).
 *
 * Recibe los gastos de ese proveedor y mes, y devuelve el id del que ya ocupa el lugar, o null.
 */
export function manualDuplicateOf(
  sameVendorAndPeriod: { id: number; invoiceNumber: string | null }[],
  selfId?: number,
): number | null {
  const dup = sameVendorAndPeriod.find((e) => e.id !== selfId && e.invoiceNumber === null);
  return dup ? dup.id : null;
}
