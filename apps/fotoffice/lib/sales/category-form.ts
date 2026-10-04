/**
 * Validación del formulario de categoría de producto. Módulo PURO.
 *
 * Diferencia deliberada con `lib/cash/category-form.ts`: la categoría de Caja exige un
 * lado —ingreso o egreso—, porque un movimiento de plata tiene que ir para alguno de los
 * dos. Una categoría de productos no tiene lados: agrupa el catálogo, no clasifica un
 * movimiento, así que no le inventamos uno.
 */

export type CategoryFormValues = {
  name: string;
  order: number;
  isActive: boolean;
};

export type CategoryFormResult =
  | { ok: true; values: CategoryFormValues }
  | { ok: false; error: string };

export function parseCategoryForm(fd: FormData): CategoryFormResult {
  const name = String(fd.get("name") ?? "").trim();
  if (name === "") return { ok: false, error: "Poné un nombre para la categoría." };

  const orderRaw = Number(String(fd.get("order") ?? "0").trim());

  return {
    ok: true,
    values: {
      name,
      order: Number.isFinite(orderRaw) ? Math.floor(orderRaw) : 0,
      isActive: fd.get("isActive") !== "off" && fd.get("isActive") !== "false",
    },
  };
}
