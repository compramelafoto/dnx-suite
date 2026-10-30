import "server-only";
import { prisma } from "@repo/db";
import { armarCatalogo, type PrecioProbador } from "./catalogo";

/**
 * Las medidas con precio del probador para un estudio: sus productos activos de Ventas con una
 * medida en el nombre (ver `armarCatalogo`). Un estudio sin esos productos recibe una lista vacía
 * y el probador sigue andando con medidas sueltas, sin precios.
 */
export async function cargarCatalogoProbador(workspaceId: string): Promise<PrecioProbador[]> {
  const productos = await prisma.product.findMany({
    where: { workspaceId, isActive: true, priceArs: { gt: 0 } },
    select: { id: true, name: true, priceArs: true, supplierName: true },
  });
  return armarCatalogo(productos.map((p) => ({ ...p, priceArs: Number(p.priceArs) })));
}
