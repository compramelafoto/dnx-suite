/**
 * Validación de los datos propios de un insumo (unidad y presentación de compra).
 * Módulo PURO, igual que `lib/sales/product-form.ts`: un formulario mandado a mano queda
 * tan protegido como uno tipeado en la pantalla.
 */

export type InsumoFormValues = {
  unidad: string;
  unidadCompra: string | null;
  unidadesPorCompra: number | null;
};

export function parseInsumoForm(
  fd: FormData,
): { ok: true; values: InsumoFormValues } | { ok: false; error: string } {
  const unidad = String(fd.get("unidad") ?? "").trim();
  if (unidad === "") return { ok: false, error: "Decí en qué se cuenta: copias, sobres, ml…" };

  const unidadCompra = String(fd.get("unidadCompra") ?? "").trim() || null;
  const cantidadRaw = String(fd.get("unidadesPorCompra") ?? "").trim();

  // Sin presentación de compra no hay a qué atar la cantidad: se descarta en vez de guardar
  // un número suelto que nadie sabría a qué se refiere.
  if (unidadCompra === null) {
    return { ok: true, values: { unidad, unidadCompra: null, unidadesPorCompra: null } };
  }

  if (cantidadRaw === "") return { ok: false, error: `Decí cuántas unidades trae cada ${unidadCompra}.` };
  const cantidad = Number(cantidadRaw);
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    return { ok: false, error: `Las unidades por ${unidadCompra} tienen que ser un número entero, de 1 en adelante.` };
  }
  return { ok: true, values: { unidad, unidadCompra, unidadesPorCompra: cantidad } };
}
