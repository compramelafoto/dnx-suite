import { saveCategoryAction } from "./actions";
import { MOVEMENT_KINDS, type MovementKind } from "@/lib/cash/constants";
import { etiquetaRubro, type RubroFila } from "@/lib/rubros/rubros";

const ETIQUETA_KIND: Record<MovementKind, string> = { INGRESO: "Ingreso", EGRESO: "Egreso" };

/**
 * Alta y edición de una categoría (rubro), con su rubro padre y su código.
 *
 * Sin estado propio —a diferencia de `AccountForm`—: nada de lo que se ve acá cambia según
 * lo que se elija, así que no hace falta correr en el navegador. Las reglas del padre (mismo
 * lado, un solo nivel) las vuelve a validar el servidor; acá sólo se ofrecen las opciones que
 * tienen sentido.
 */
export function CategoryForm({
  category,
  padres,
  tieneHijos = false,
}: {
  category: RubroFila | null;
  /** Rubros de primer nivel que pueden ser padres (de los dos lados en un alta). */
  padres: readonly RubroFila[];
  tieneHijos?: boolean;
}) {
  const id = category?.id ?? "nueva";
  const opciones = padres.filter((p) => p.id !== category?.id && (!category || p.kind === category.kind));
  const porLado = MOVEMENT_KINDS.map((k) => ({ kind: k, rubros: opciones.filter((p) => p.kind === k) })).filter(
    (g) => g.rubros.length > 0,
  );

  return (
    <form action={saveCategoryAction} className="grid gap-3 sm:grid-cols-6 sm:items-end">
      {category ? <input type="hidden" name="categoryId" value={category.id} /> : null}

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={`cat-code-${id}`}>
          Código
        </label>
        <input
          id={`cat-code-${id}`}
          name="code"
          className="fo-input"
          defaultValue={category?.code ?? ""}
          placeholder="3.1.2"
          maxLength={20}
        />
      </div>

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

      <div className="fo-field-stack sm:col-span-2">
        <label className="fo-label" htmlFor={`cat-parent-${id}`}>
          Rubro padre
        </label>
        {tieneHijos ? (
          // Un rubro que ya es padre no puede quedar dentro de otro: un solo nivel.
          <p id={`cat-parent-${id}`} className="fo-helper py-2">
            Tiene subrubros: es de primer nivel.
          </p>
        ) : (
          <select
            id={`cat-parent-${id}`}
            name="parentCategoryId"
            className="fo-input"
            defaultValue={category?.parentCategoryId ?? ""}
          >
            <option value="">Ninguno (primer nivel)</option>
            {porLado.map((g) => (
              <optgroup key={g.kind} label={g.kind === "INGRESO" ? "Ingresos" : "Egresos"}>
                {g.rubros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {etiquetaRubro(p)}
                    {p.isActive ? "" : " (dado de baja)"}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
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
