import { saveCategoryAction } from "./actions";
import { MOVEMENT_KINDS, type MovementKind } from "@/lib/cash/constants";
import type { CashCategoryRow } from "@/lib/cash/repository";

const ETIQUETA_KIND: Record<MovementKind, string> = { INGRESO: "Ingreso", EGRESO: "Egreso" };

/**
 * Alta y edición de una categoría.
 *
 * Sin estado propio —a diferencia de `AccountForm`—: nada de lo que se ve acá cambia según
 * lo que se elija, así que no hace falta correr en el navegador.
 */
export function CategoryForm({ category }: { category: CashCategoryRow | null }) {
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
          placeholder="Proveedores"
          required
        />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={`cat-kind-${id}`}>
          Lado
        </label>
        <select id={`cat-kind-${id}`} name="kind" className="fo-input" defaultValue={category?.kind ?? ""} required>
          {!category ? <option value="" disabled /> : null}
          {MOVEMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {ETIQUETA_KIND[k]}
            </option>
          ))}
        </select>
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
