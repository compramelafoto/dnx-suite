import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { MAX_DESCRIPCION_ITEM, MAX_NOMBRE_ITEM, type ItemPresupuesto } from "./constantes";
import { calcularItemDelPanel, trabajoDesdeMotor } from "./panel-cuanto-cobro";

/**
 * PURO (sin servidor ni base). Convierte los ítems de una propuesta modelo en los ítems de un
 * presupuesto nuevo, "a hoy":
 * - producto de lista: nombre, descripción y precio del catálogo de ahora, clave nueva;
 * - concepto calculado: se vuelve a correr el motor con el perfil de precios del workspace
 *   (el perfil NO vive en la propuesta). Sin perfil, no se puede.
 */
export type ProductoDeCatalogo = { nombre: string; descripcion: string | null; precio: number };

export type DepsInstanciar = {
  productos: Map<string, ProductoDeCatalogo>;
  perfil: CuantoCobroProfileInput | null;
  nuevaClave: () => string;
  ahora?: Date;
};

export type ResultadoInstanciar =
  | { ok: true; items: ItemPresupuesto[] }
  | { ok: false; motivo: "PRODUCTO_INACTIVO" | "SIN_PERFIL" | "CALCULO" };

export function instanciarPropuesta(items: ItemPresupuesto[], deps: DepsInstanciar): ResultadoInstanciar {
  const out: ItemPresupuesto[] = [];
  for (const it of items) {
    if (it.modoPrecio === "CALCULO") {
      if (!deps.perfil) return { ok: false, motivo: "SIN_PERFIL" };
      const concepto = trabajoDesdeMotor((it.calculo as { entrada?: { presupuesto?: unknown } } | null)?.entrada?.presupuesto);
      if (!concepto) return { ok: false, motivo: "CALCULO" };
      const r = calcularItemDelPanel(
        deps.perfil,
        concepto.trabajo,
        concepto.tipoDeTrabajo,
        { id: deps.nuevaClave(), nombre: it.nombre, seccion: it.seccion, opcional: it.opcional, descuento: it.descuento },
        deps.ahora,
      );
      if (!r.ok) return { ok: false, motivo: "CALCULO" };
      out.push(r.item);
      continue;
    }
    const p = it.productId ? deps.productos.get(it.productId) : undefined;
    // Un producto que se archivó o se borró después: la propuesta quedó vieja y no se manda a medias.
    if (!p) return { ok: false, motivo: "PRODUCTO_INACTIVO" };
    out.push({
      ...it,
      id: deps.nuevaClave(),
      nombre: p.nombre.trim().slice(0, MAX_NOMBRE_ITEM) || it.nombre,
      descripcion: p.descripcion?.trim() ? p.descripcion.trim().slice(0, MAX_DESCRIPCION_ITEM) : null,
      precioUnitario: p.precio,
      modoPrecio: "LISTA",
      calculo: null,
    });
  }
  return { ok: true, items: out };
}
