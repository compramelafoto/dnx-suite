/**
 * Proyectos que corresponde crear al confirmar un pedido (Etapa 4, Entrega A). Módulo PURO: recibe
 * datos planos (los ítems de la instantánea del pedido, las reglas de los productos y los
 * componentes de los combos) y devuelve los proyectos a crear. No lee la base.
 *
 * Reglas (las mismas que `cuentasDesdeCostos`, de `lib/pedidos/costos.ts`):
 * - sólo cuentan los ítems del catálogo (con `productId`) que suman al total: los de texto libre y
 *   los opcionales no generan proyectos; tampoco los de cantidad cero;
 * - la cantidad NO multiplica: una regla da un proyecto por ítem, sea cual sea la cantidad;
 * - si el producto es un combo, además de sus propias reglas van las de cada componente (un combo
 *   puede tener otro combo adentro; un ciclo, que el catálogo no permite, se corta igual);
 * - `pedidoItemIndex` es la posición del ítem en la instantánea del pedido (los proyectos de los
 *   componentes de un combo llevan la del ítem del combo);
 * - el único (pedido, ítem, flujo) del SQL impide dos proyectos del mismo flujo para un ítem: si dos
 *   reglas (de un combo y su componente, o de dos componentes) usan el mismo flujo, queda la primera.
 */
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { PROFUNDIDAD_MAXIMA_COMBOS } from "./constantes";

/** Lo que se lee de cada ítem de la instantánea del pedido. */
export type ItemParaProyectos = Pick<ItemPresupuesto, "productId" | "cantidad" | "opcional">;

/** Una regla de producto (`FotofficeProductoProyecto`). */
export type ReglaProyecto = {
  productId: string;
  circuitId: string;
  ownerUserId: number | null;
  daysFromEvent: number;
  nameTemplate: string | null;
};

/** Un componente de combo (`FotofficeComboItem`). */
export type ComponenteComboParaProyectos = {
  comboProductId: string;
  componentProductId: string;
  quantity: number;
};

export type ProyectoDesdeRegla = {
  pedidoItemIndex: number;
  /** El producto dueño de la regla (el componente, si la regla viene de un combo). */
  productId: string;
  circuitId: string;
  ownerUserId: number | null;
  daysFromEvent: number;
  nameTemplate: string | null;
};

export function proyectosDelPedido(
  items: readonly ItemParaProyectos[],
  reglas: readonly ReglaProyecto[],
  combos: readonly ComponenteComboParaProyectos[],
): ProyectoDesdeRegla[] {
  const reglasPorProducto = new Map<string, ReglaProyecto[]>();
  for (const r of reglas) {
    const lista = reglasPorProducto.get(r.productId) ?? [];
    lista.push(r);
    reglasPorProducto.set(r.productId, lista);
  }
  const componentesPorCombo = new Map<string, ComponenteComboParaProyectos[]>();
  for (const c of combos) {
    const lista = componentesPorCombo.get(c.comboProductId) ?? [];
    lista.push(c);
    componentesPorCombo.set(c.comboProductId, lista);
  }

  const out: ProyectoDesdeRegla[] = [];

  items.forEach((it, indice) => {
    if (it.opcional) return;
    if (typeof it.productId !== "string" || it.productId === "") return;
    if (!(Number.isFinite(it.cantidad) && it.cantidad > 0)) return;

    const vistos = new Set<string>(); // flujos ya usados por este ítem

    const agregar = (productId: string, camino: ReadonlySet<string>, profundidad: number) => {
      for (const r of reglasPorProducto.get(productId) ?? []) {
        if (vistos.has(r.circuitId)) continue;
        vistos.add(r.circuitId);
        out.push({
          pedidoItemIndex: indice,
          productId,
          circuitId: r.circuitId,
          ownerUserId: r.ownerUserId ?? null,
          daysFromEvent: Number.isInteger(r.daysFromEvent) ? r.daysFromEvent : 0,
          nameTemplate: r.nameTemplate?.trim() ? r.nameTemplate : null,
        });
      }
      if (profundidad >= PROFUNDIDAD_MAXIMA_COMBOS) return;
      for (const comp of componentesPorCombo.get(productId) ?? []) {
        if (camino.has(comp.componentProductId)) continue;
        if (!(Number.isFinite(comp.quantity) && comp.quantity > 0)) continue;
        agregar(comp.componentProductId, new Set([...camino, comp.componentProductId]), profundidad + 1);
      }
    };

    agregar(it.productId, new Set([it.productId]), 0);
  });
  return out;
}
