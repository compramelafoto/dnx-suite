import "server-only";
import { prisma } from "@repo/db";
import { DIAS_DE_CONSUMO, type ItemStock } from "./avisos";

/** Avisos de compra contra la base. */

const MS_DIA = 24 * 60 * 60 * 1000;
const RAZONES_QUE_CONSUMEN = ["VENTA", "CONSUMO", "PEDIDO"];
const RAZONES = [...RAZONES_QUE_CONSUMEN, "DEVOLUCION"];

/**
 * Cuánto salió de cada producto en los últimos 30 días corridos: lo que se vendió, consumió
 * o fue a un pedido, menos lo que volvió por devolución. Nunca negativo.
 */
export async function consumo30PorProducto(
  workspaceId: string,
  ahora: Date = new Date(),
): Promise<Map<string, number>> {
  const desde = new Date(ahora.getTime() - DIAS_DE_CONSUMO * MS_DIA);
  const filas = await prisma.stockMovement.groupBy({
    by: ["productId", "reason"],
    where: { workspaceId, reason: { in: RAZONES }, createdAt: { gte: desde } },
    _sum: { qty: true },
  });
  const neto = new Map<string, number>();
  for (const f of filas) {
    const qty = Number(f._sum.qty ?? 0);
    // Las salidas vienen firmadas en negativo; la devolución suma. Consumo = -Σ.
    neto.set(f.productId, (neto.get(f.productId) ?? 0) - qty);
  }
  for (const [k, v] of neto) neto.set(k, Math.max(0, v));
  return neto;
}

/** Los productos con control de stock, listos para calcular qué comprar. */
export async function itemsDeStock(workspaceId: string): Promise<ItemStock[]> {
  const [productos, consumo] = await Promise.all([
    prisma.product.findMany({
      where: { workspaceId, isActive: true, tracksStock: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        stockQty: true,
        minStockQty: true,
        tracksStock: true,
        supplierName: true,
        fotofficeInsumo: { select: { unidad: true, unidadCompra: true, unidadesPorCompra: true } },
      },
    }),
    consumo30PorProducto(workspaceId),
  ]);
  return productos.map((p) => ({
    productId: p.id,
    nombre: p.name,
    stockQty: p.stockQty,
    minStockQty: p.minStockQty,
    tracksStock: p.tracksStock,
    unidad: p.fotofficeInsumo?.unidad ?? null,
    proveedor: p.supplierName,
    unidadCompra: p.fotofficeInsumo?.unidadCompra ?? null,
    unidadesPorCompra: p.fotofficeInsumo?.unidadesPorCompra ?? null,
    consumo30: consumo.get(p.id) ?? 0,
  }));
}
