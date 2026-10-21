/**
 * Conversión de unidades de compra a unidades de stock. Módulo PURO: lo usan el servidor y
 * pantallas que corren en el navegador (la recepción), así que no puede importar nada marcado
 * `server-only` — por eso no vive en `kodak305.ts`, que sí lo está.
 */

/**
 * Una entrada cargada en la presentación de compra (kits) pasada a la unidad en que se
 * descuenta (copias). El costo se carga por kit y se reparte entre las copias del kit.
 */
export function entradaEnUnidades(d: {
  cantidad: number;
  enUnidadDeCompra: boolean;
  unidadesPorCompra: number | null;
  costoMinor: number | null;
}): { qty: number; unitCostMinor: number | null } {
  if (!d.enUnidadDeCompra || !d.unidadesPorCompra || d.unidadesPorCompra < 1) {
    return { qty: d.cantidad, unitCostMinor: d.costoMinor };
  }
  return {
    qty: d.cantidad * d.unidadesPorCompra,
    unitCostMinor: d.costoMinor === null ? null : Math.round(d.costoMinor / d.unidadesPorCompra),
  };
}
