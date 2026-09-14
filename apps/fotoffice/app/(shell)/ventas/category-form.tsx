import { saveCategoryAction } from "./actions";
import type { ProductCategoryRow } from "@/lib/sales/repository";

/**
 * Alta y edición de una categoría de productos.
 *
 * Diferencia deliberada con la de Caja: acá no hay "lado" que elegir. Una categoría de
 * productos agrupa el catálogo —marcos, portarretratos, impresiones—, no clasifica un
 * movimiento de plata, así que no le inventamos un ingreso o egreso que no tiene.
 */
export function CategoryForm({ category }: { category: ProductCategoryRow | null }) {
  const id = category?.id ?? "nueva";
  return (
    <form action={saveCategoryAction} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      {category ? <input type="hidden" name="categoryId" value={category.id} /> : null}

      <div className="fo-field-stack sm:col-span-2">
        <label className="fo-label" htmlFor={`cat-name-${id}`}>
          Nombre
        </label>
        <input
          id={`cat-name-${id}`}
          name="name"
          className="fo-input"
          defaultValue={category?.name ?? ""}
          placeholder="Marcos"
          required
        />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={`cat-order-${id}`}>
          Orden
        </label>
        <input
          id={`cat-order-${id}`}
          name="order"
          type="number"
          className="fo-input"
          defaultValue={category?.order ?? 0}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={category?.isActive ?? true} />
        Activa
      </label>

      <div className="sm:col-span-4">
        <button type="submit" className="fo-btn fo-btn-secondary text-sm">
          {category ? "Guardar" : "Agregar categoría"}
        </button>
      </div>
    </form>
  );
}
