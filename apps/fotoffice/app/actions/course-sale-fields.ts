/**
 * Los campos con los que se vende un curso grabado, leídos del formulario del panel.
 *
 * Existen porque el formulario no los tenía: el precio de un grabado no se podía cargar, y
 * cada guardado lo dejaba en null porque la acción leía un campo que no venía.
 */
export function leerCamposDeVenta(formData: FormData): {
  priceArs: number | null;
  accessMonths: number;
  completionPercent: number;
  freeForMembers: boolean;
} {
  const precio = formData.get("priceArs")?.toString().trim().replace(",", ".");
  return {
    priceArs: precio ? Number(precio) : null,
    accessMonths: Number(formData.get("accessMonths")?.toString() || 12),
    completionPercent: Number(formData.get("completionPercent")?.toString() || 80),
    freeForMembers: formData.get("freeForMembers") === "on",
  };
}
