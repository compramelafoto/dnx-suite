/**
 * Citas que corresponde crear al confirmar un pedido (Etapa 4, Entrega B). Módulo PURO: recibe datos
 * planos (los ítems de la instantánea del pedido, las reglas de los productos y los componentes de los
 * combos) y devuelve las citas a crear. No lee la base. Mismas reglas que `proyectosDelPedido`:
 *
 * - sólo cuentan los ítems del catálogo (con `productId`) que suman al total: los de texto libre, los
 *   opcionales y los de cantidad cero no generan citas;
 * - la cantidad NO multiplica: una regla da una cita por ítem;
 * - si el producto es un combo, además de sus reglas van las de cada componente (combos anidados incluidos;
 *   un ciclo, que el catálogo no permite, se corta igual);
 * - `pedidoItemIndex` es la posición del ítem en la instantánea (los componentes de un combo llevan la del
 *   ítem del combo);
 * - el único (pedido, ítem, regla) del SQL impide repetir una regla: se identifica por `reglaId`, y si la
 *   misma regla se alcanza dos veces en un ítem (el mismo componente repetido), queda la primera.
 */
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { DURACION_MINUTOS_POR_OMISION, PROFUNDIDAD_MAXIMA_COMBOS } from "./constantes";

export type ItemParaCitas = Pick<ItemPresupuesto, "productId" | "cantidad" | "opcional">;

/** Una regla de producto (`FotofficeProductoCita`). */
export type ReglaCita = {
  id: string;
  productId: string;
  typeId: string | null;
  title: string | null;
  daysFromEvent: number;
  startTime: string | null;
  durationMinutes: number;
  ownerUserId: number | null;
};

/** Un componente de combo (`FotofficeComboItem`). */
export type ComponenteComboParaCitas = {
  comboProductId: string;
  componentProductId: string;
  quantity: number;
};

export type CitaDesdeRegla = {
  pedidoItemIndex: number;
  reglaId: string;
  /** El producto dueño de la regla (el componente, si la regla viene de un combo). */
  productId: string;
  typeId: string | null;
  title: string | null;
  daysFromEvent: number;
  startTime: string | null;
  durationMinutes: number;
  ownerUserId: number | null;
};

export function citasDelPedido(
  items: readonly ItemParaCitas[],
  reglas: readonly ReglaCita[],
  combos: readonly ComponenteComboParaCitas[],
): CitaDesdeRegla[] {
  const reglasPorProducto = new Map<string, ReglaCita[]>();
  for (const r of reglas) {
    const lista = reglasPorProducto.get(r.productId) ?? [];
    lista.push(r);
    reglasPorProducto.set(r.productId, lista);
  }
  const componentesPorCombo = new Map<string, ComponenteComboParaCitas[]>();
  for (const c of combos) {
    const lista = componentesPorCombo.get(c.comboProductId) ?? [];
    lista.push(c);
    componentesPorCombo.set(c.comboProductId, lista);
  }

  const out: CitaDesdeRegla[] = [];

  items.forEach((it, indice) => {
    if (it.opcional) return;
    if (typeof it.productId !== "string" || it.productId === "") return;
    if (!(Number.isFinite(it.cantidad) && it.cantidad > 0)) return;

    const vistas = new Set<string>(); // reglas ya usadas por este ítem

    const agregar = (productId: string, camino: ReadonlySet<string>, profundidad: number) => {
      for (const r of reglasPorProducto.get(productId) ?? []) {
        if (vistas.has(r.id)) continue;
        vistas.add(r.id);
        out.push({
          pedidoItemIndex: indice,
          reglaId: r.id,
          productId,
          typeId: r.typeId ?? null,
          title: r.title?.trim() ? r.title : null,
          daysFromEvent: Number.isInteger(r.daysFromEvent) ? r.daysFromEvent : 0,
          startTime: r.startTime ?? null,
          durationMinutes:
            Number.isFinite(r.durationMinutes) && r.durationMinutes > 0 ? Math.trunc(r.durationMinutes) : DURACION_MINUTOS_POR_OMISION,
          ownerUserId: r.ownerUserId ?? null,
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

/** Claves ya creadas (`pedidoItemIndex:reglaId`) para filtrar lo que falta crear (idempotencia). */
export function claveDeCita(c: { pedidoItemIndex: number; reglaId: string }): string {
  return `${c.pedidoItemIndex}:${c.reglaId}`;
}

export function citasQueFaltan(
  deseadas: readonly CitaDesdeRegla[],
  existentes: readonly { pedidoItemIndex: number | null; reglaId: string | null }[],
): CitaDesdeRegla[] {
  const ya = new Set<string>();
  for (const e of existentes) if (e.pedidoItemIndex !== null && e.reglaId !== null) ya.add(claveDeCita({ pedidoItemIndex: e.pedidoItemIndex, reglaId: e.reglaId }));
  return deseadas.filter((d) => !ya.has(claveDeCita(d)));
}
