import type { StorefrontProductRow } from "../storefront";

/**
 * Lo que una línea de producto copia del catálogo al crear el pedido, para el productor
 * (dropshipping). Módulo PURO. Se copia y no se lee después del catálogo: si mañana se edita el
 * producto, el pedido sigue diciendo lo que se vendió.
 *
 * - `sku`: el del talle; si no tiene, el del producto.
 * - `printFileUrl`: el archivo del talle; si no tiene, el de la ficha online.
 * - `fulfillmentProveedorId`: quién lo produce (null = lo prepara el negocio).
 */
export type FulfillmentSnapshot = {
  sku: string | null;
  fulfillmentProveedorId: string | null;
  printFileUrl: string | null;
};

function limpio(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export function fulfillmentSnapshot(
  row: StorefrontProductRow | undefined,
  variantId: string | null,
): FulfillmentSnapshot {
  if (!row) return { sku: null, fulfillmentProveedorId: null, printFileUrl: null };
  const talle = variantId ? row.variants.find((v) => v.id === variantId) : undefined;
  return {
    sku: limpio(talle?.sku) ?? limpio(row.sku),
    fulfillmentProveedorId: row.listing.fulfillmentProveedorId ?? null,
    printFileUrl: limpio(talle?.printFileUrl) ?? limpio(row.listing.printFileUrl),
  };
}
