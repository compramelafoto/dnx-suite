/**
 * Los campos con los que se vende un curso grabado, leídos del formulario del panel.
 *
 * Existen porque el formulario no los tenía: el precio de un grabado no se podía cargar, y
 * cada guardado lo dejaba en null porque la acción leía un campo que no venía.
 */
/**
 * Lee un precio con formato argentino: `45000`, `45.000`, `45.000,50`, `45000,50`, `45000.5`.
 * Cualquier otra cosa devuelve NaN para que la validación la rechace (nunca un número equivocado).
 */
function leerPrecio(texto: string): number {
  const t = texto.trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^\d+[.,]\d{1,2}$/.test(t)) return Number(t.replace(",", "."));
  return NaN;
}

export function leerCamposDeVenta(formData: FormData): {
  priceArs: number | null;
  accessMonths: number;
  completionPercent: number;
  freeForMembers: boolean;
} {
  const precio = formData.get("priceArs")?.toString().trim();
  return {
    priceArs: precio ? leerPrecio(precio) : null,
    accessMonths: Number(formData.get("accessMonths")?.toString() || 12),
    completionPercent: Number(formData.get("completionPercent")?.toString() || 80),
    freeForMembers: formData.get("freeForMembers") === "on",
  };
}
