import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { analizar, type Analisis, type RenglonAnalisis, type VentaAnalisis } from "./analisis";

/**
 * Lo que lee el análisis de ventas: las ventas del mostrador (sin anular) y los pedidos (sin
 * cancelar) del período, con sus renglones y la categoría de cada producto.
 */

type ItemPedido = { productId?: unknown; nombre?: unknown; cantidad?: unknown; precioUnitario?: unknown };

export async function analisisDeVentas(workspaceId: string, desde: Date, hasta: Date): Promise<Analisis & { nombres: Record<number, string> }> {
  const [ventas, pedidos, productos, equipo] = await Promise.all([
    prisma.sale.findMany({
      where: { workspaceId, status: "COMPLETADA", voidedAt: null, occurredAt: { gte: desde, lte: hasta } },
      select: {
        occurredAt: true,
        totalArs: true,
        createdByUserId: true,
        items: { select: { productId: true, description: true, qty: true, lineTotalArs: true } },
      },
    }),
    prisma.fotofficePedido.findMany({
      where: { workspaceId, status: { not: "CANCELADO" }, createdAt: { gte: desde, lte: hasta } },
      select: { createdAt: true, totalArs: true, createdByUserId: true, items: true },
    }),
    prisma.product.findMany({ where: { workspaceId }, select: { id: true, name: true, category: { select: { name: true } } } }),
    prisma.workspaceMembership.findMany({ where: { workspaceId }, select: { user: { select: { id: true, name: true, email: true } } } }),
  ]);
  const producto = new Map(productos.map((p) => [p.id, { nombre: p.name, categoria: p.category?.name ?? "Sin categoría" }]));
  const categoriaDe = (productId: string | null) => (productId ? (producto.get(productId)?.categoria ?? "Sin categoría") : "Renglón suelto");

  const deVentas: VentaAnalisis[] = ventas.map((v) => ({
    fecha: v.occurredAt,
    totalMinor: decimalArsToMinor(v.totalArs),
    vendedorId: v.createdByUserId,
    renglones: v.items.map((i) => ({
      productId: i.productId,
      nombre: (i.productId && producto.get(i.productId)?.nombre) || i.description,
      categoria: categoriaDe(i.productId),
      unidades: i.qty,
      importeMinor: decimalArsToMinor(i.lineTotalArs),
    })),
  }));
  const dePedidos: VentaAnalisis[] = pedidos.map((p) => ({
    fecha: p.createdAt,
    totalMinor: decimalArsToMinor(p.totalArs),
    vendedorId: p.createdByUserId,
    renglones: renglonesDelPedido(p.items, (id) => producto.get(id)?.nombre ?? null, categoriaDe),
  }));
  return {
    ...analizar([...deVentas, ...dePedidos]),
    nombres: Object.fromEntries(equipo.map((m) => [m.user.id, m.user.name?.trim() || m.user.email])),
  };
}

function renglonesDelPedido(
  items: Prisma.JsonValue,
  nombreDe: (productId: string) => string | null,
  categoriaDe: (productId: string | null) => string,
): RenglonAnalisis[] {
  if (!Array.isArray(items)) return [];
  return (items as ItemPedido[]).map((i) => {
    const productId = typeof i?.productId === "string" ? i.productId : null;
    const cantidad = typeof i?.cantidad === "number" ? i.cantidad : 0;
    const precio = typeof i?.precioUnitario === "number" ? i.precioUnitario : 0;
    return {
      productId,
      nombre: (productId && nombreDe(productId)) || (typeof i?.nombre === "string" ? i.nombre : "Sin nombre"),
      categoria: categoriaDe(productId),
      unidades: cantidad,
      importeMinor: Math.round(cantidad * precio * 100),
    };
  });
}
