import { needsRestock } from "@/lib/sales/stock";

/**
 * Avisos de compra (stock etapa 4). Módulo PURO: nada acá toca la base.
 * Qué conviene comprar sale de dos señales: lo que la gente ya declaró (el mínimo, los
 * negativos) y lo que realmente se consume (cuántos días le quedan a lo que hay).
 */

/** Hasta cuántos días de cobertura se considera «para comprar». */
export const UMBRAL_DIAS_COMPRA = 7;
export const DIAS_DE_CONSUMO = 30;

export type ItemStock = {
  productId: string;
  nombre: string;
  stockQty: number;
  minStockQty: number | null;
  tracksStock: boolean;
  unidad: string | null;
  proveedor: string | null;
  unidadCompra: string | null;
  unidadesPorCompra: number | null;
  consumo30: number;
};

export type ItemParaComprar = ItemStock & { dias: number | null };

export function consumoDiario(consumo30: number): number {
  return Math.max(0, consumo30) / DIAS_DE_CONSUMO;
}

/** Días que dura lo que hay. `null` = no hubo consumo, no se puede estimar. */
export function diasDeCobertura(stockQty: number, consumoDia: number): number | null {
  if (consumoDia > 0 && stockQty > 0) return Math.floor(stockQty / consumoDia);
  if (stockQty <= 0) return 0;
  return null;
}

export function textoCobertura(dias: number | null): string {
  if (dias === null) return "Sin consumo en 30 días";
  if (dias <= 0) return "Se termina hoy";
  return `Te alcanza para ~${dias} días`;
}

function conDias(i: ItemStock): ItemParaComprar {
  return { ...i, dias: diasDeCobertura(i.stockQty, consumoDiario(i.consumo30)) };
}

/** Lo que hay que comprar: bajo mínimo o negativo, o que dura una semana o menos. */
export function paraComprar(items: readonly ItemStock[]): ItemParaComprar[] {
  return items
    .filter((i) => i.tracksStock)
    .map(conDias)
    .filter((i) => needsRestock(i) || (i.dias !== null && i.dias <= UMBRAL_DIAS_COMPRA))
    .sort((a, b) => {
      const na = a.stockQty < 0 ? 0 : 1;
      const nb = b.stockQty < 0 ? 0 : 1;
      if (na !== nb) return na - nb;
      const da = a.dias ?? Number.POSITIVE_INFINITY;
      const db = b.dias ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.nombre.localeCompare(b.nombre, "es");
    });
}

/** Cuánto pedir: lo que falta para el mínimo o para un mes de consumo, y al menos uno. */
export function cantidadSugerida(i: ItemStock): number {
  const min = i.minStockQty ?? 0;
  return Math.ceil(Math.max(min - i.stockQty, i.consumo30 - i.stockQty, 1));
}

export type ListaProveedor = {
  proveedor: string;
  renglones: { texto: string }[];
  textoCopiable: string;
};

function renglon(i: ItemStock): string {
  const qty = cantidadSugerida(i);
  if (i.unidadCompra && i.unidadesPorCompra && i.unidadesPorCompra > 0) {
    return `${Math.ceil(qty / i.unidadesPorCompra)} ${i.unidadCompra} ${i.nombre}`;
  }
  return [String(qty), i.unidad, i.nombre].filter(Boolean).join(" ");
}

export function listaPorProveedor(items: readonly ItemStock[]): ListaProveedor[] {
  const grupos = new Map<string, ItemStock[]>();
  for (const i of paraComprar(items)) {
    const p = i.proveedor?.trim() || "Sin proveedor";
    grupos.set(p, [...(grupos.get(p) ?? []), i]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => {
      if (a === "Sin proveedor") return 1;
      if (b === "Sin proveedor") return -1;
      return a.localeCompare(b, "es");
    })
    .map(([proveedor, its]) => {
      const renglones = its.map((i) => ({ texto: renglon(i) }));
      return {
        proveedor,
        renglones,
        textoCopiable: `Pedido para ${proveedor}:\n${renglones.map((r) => `- ${r.texto}`).join("\n")}`,
      };
    });
}
