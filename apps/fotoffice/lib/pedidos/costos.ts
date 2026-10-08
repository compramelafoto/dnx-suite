/**
 * Cuentas a pagar de un pedido a partir de los costos-plantilla del catálogo (Entrega B1). Módulo
 * PURO: recibe datos planos (los ítems de la instantánea del pedido, los costos-plantilla, los
 * componentes de los combos y la fecha del evento) y devuelve las cuentas a crear. No lee la base.
 *
 * Reglas:
 * - sólo cuentan los ítems del catálogo (con `productId`) que suman al total: los de texto libre y
 *   los opcionales no generan cuentas (igual que en los totales y en el costo del presupuesto);
 * - un costo por unidad se multiplica por la cantidad; uno fijo va una sola vez por ítem;
 * - si el producto es un combo, además de sus propios costos van los de cada componente, con la
 *   cantidad del componente × la cantidad del ítem (un combo puede tener otro combo adentro; un
 *   ciclo, que el catálogo no permite, se corta igual);
 * - el vencimiento es la fecha del evento + `daysFromEvent`; sin fecha de evento, `null`;
 * - el concepto es el del costo, con el nombre del producto si se conoce ("Impresión · Álbum 30×30");
 * - las cuentas se calculan en centavos enteros; las que dan cero no se generan (el SQL exige
 *   importe mayor que cero).
 */
import { decimalArsToMinor } from "@/lib/membership/money";
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";

/** Lo que se lee de cada ítem de la instantánea del pedido. */
export type ItemParaCostos = Pick<ItemPresupuesto, "productId" | "cantidad" | "opcional"> & {
  nombre?: string | null;
};

/** Un costo-plantilla (`FotofficeCostoPlantilla`). `amountArs` en pesos (número, texto o `Decimal`). */
export type CostoPlantillaParaCuentas = {
  id: string;
  productId: string;
  supplierClientId: string | null;
  concept: string;
  amountArs: number | string | { toString(): string };
  perUnit: boolean;
  daysFromEvent: number;
};

/** Un componente de combo (`FotofficeComboItem`). */
export type ComponenteComboParaCuentas = {
  comboProductId: string;
  componentProductId: string;
  quantity: number;
};

export type CuentaDesdeCosto = {
  costoPlantillaId: string;
  supplierClientId: string | null;
  concept: string;
  /** Pesos con dos decimales (calculado en centavos). */
  amountArs: number;
  /** "YYYY-MM-DD" (fecha de Argentina) o null si el pedido no tiene fecha de evento. */
  dueDate: string | null;
};

export type EntradaCuentasDesdeCostos = {
  items: readonly ItemParaCostos[];
  costos: readonly CostoPlantillaParaCuentas[];
  combos: readonly ComponenteComboParaCuentas[];
  /** "YYYY-MM-DD", o el `Date` de una columna `@db.Date` (medianoche UTC); null si no hay. */
  fechaEvento: string | Date | null;
  /** Nombre de cada producto (por id), para el concepto. Si falta, se usa el nombre del ítem. */
  nombres?: ReadonlyMap<string, string>;
};

/** Hasta dónde se baja dentro de combos anidados (el catálogo no tiene ciclos; es un resguardo). */
const PROFUNDIDAD_MAXIMA = 10;

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** La fecha del evento como "YYYY-MM-DD", o null si no hay o no es válida. */
function fechaBase(fecha: string | Date | null): string | null {
  if (fecha === null) return null;
  if (fecha instanceof Date) return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString().slice(0, 10);
  const m = FECHA.exec(fecha.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === fecha.trim() ? fecha.trim() : null;
}

/** Suma días a una fecha "YYYY-MM-DD" (aritmética de calendario, sin husos horarios). */
function sumarDias(fecha: string, dias: number): string {
  const m = FECHA.exec(fecha)!;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias));
  return d.toISOString().slice(0, 10);
}

export function cuentasDesdeCostos(entrada: EntradaCuentasDesdeCostos): CuentaDesdeCosto[] {
  const { items, costos, combos, nombres } = entrada;
  const base = fechaBase(entrada.fechaEvento);

  const costosPorProducto = new Map<string, CostoPlantillaParaCuentas[]>();
  for (const c of costos) {
    const lista = costosPorProducto.get(c.productId) ?? [];
    lista.push(c);
    costosPorProducto.set(c.productId, lista);
  }
  const componentesPorCombo = new Map<string, ComponenteComboParaCuentas[]>();
  for (const c of combos) {
    const lista = componentesPorCombo.get(c.comboProductId) ?? [];
    lista.push(c);
    componentesPorCombo.set(c.comboProductId, lista);
  }

  const out: CuentaDesdeCosto[] = [];

  const agregar = (productId: string, cantidad: number, nombre: string | null, camino: ReadonlySet<string>, profundidad: number) => {
    for (const c of costosPorProducto.get(productId) ?? []) {
      const unitario = decimalArsToMinor(c.amountArs);
      const centavos = c.perUnit ? Math.round(unitario * cantidad) : unitario;
      if (!Number.isFinite(centavos) || centavos <= 0) continue;
      const dias = Number.isInteger(c.daysFromEvent) ? c.daysFromEvent : 0;
      out.push({
        costoPlantillaId: c.id,
        supplierClientId: c.supplierClientId,
        concept: nombre ? `${c.concept} · ${nombre}` : c.concept,
        amountArs: centavos / 100,
        dueDate: base === null ? null : sumarDias(base, dias),
      });
    }
    if (profundidad >= PROFUNDIDAD_MAXIMA) return;
    for (const comp of componentesPorCombo.get(productId) ?? []) {
      if (camino.has(comp.componentProductId)) continue;
      const q = Number.isFinite(comp.quantity) && comp.quantity > 0 ? comp.quantity : 0;
      if (q === 0) continue;
      agregar(
        comp.componentProductId,
        cantidad * q,
        nombres?.get(comp.componentProductId) ?? null,
        new Set([...camino, comp.componentProductId]),
        profundidad + 1,
      );
    }
  };

  for (const it of items) {
    if (it.opcional) continue;
    if (typeof it.productId !== "string" || it.productId === "") continue;
    const cantidad = Number.isFinite(it.cantidad) && it.cantidad > 0 ? it.cantidad : 0;
    if (cantidad === 0) continue;
    const nombre = nombres?.get(it.productId) ?? (it.nombre?.trim() || null);
    agregar(it.productId, cantidad, nombre, new Set([it.productId]), 0);
  }
  return out;
}
