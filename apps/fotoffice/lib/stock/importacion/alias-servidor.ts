import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { normalizeBarcode } from "@/lib/sales/barcode";
import { normalizarTexto, type IndiceAsociacion } from "./asociar";

/** Índices de productos y alias del proveedor para asociar filas importadas. */
export async function indiceParaAsociar(workspaceId: string, proveedorId: string | null): Promise<IndiceAsociacion> {
  const [productos, alias] = await Promise.all([
    prisma.product.findMany({
      where: { workspaceId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, barcode: true, sku: true },
    }),
    proveedorId
      ? prisma.fotofficeAliasProveedor.findMany({
          where: { workspaceId, proveedorId, product: { isActive: true, workspaceId } },
          select: { textoNormalizado: true, productId: true },
        })
      : Promise.resolve([]),
  ]);
  const porBarcode = new Map<string, string>();
  const porSku = new Map<string, string>();
  for (const p of productos) {
    const b = p.barcode ? normalizeBarcode(p.barcode) : null;
    if (b && !porBarcode.has(b)) porBarcode.set(b, p.id);
    const s = p.sku ? p.sku.trim().toLowerCase() : "";
    if (s && !porSku.has(s)) porSku.set(s, p.id);
  }
  const porAlias = new Map(alias.map((a) => [a.textoNormalizado, a.productId]));
  return { porBarcode, porSku, porAlias, catalogo: productos.map((p) => ({ id: p.id, nombre: p.name })) };
}

/**
 * Recuerda qué producto es esta descripción para este proveedor. Devuelve false (sin tocar nada)
 * si el texto queda vacío o si el proveedor o el producto no son de este negocio.
 */
export async function guardarAlias(
  tx: Prisma.TransactionClient,
  datos: { workspaceId: string; proveedorId: string; descripcion: string; productId: string },
): Promise<boolean> {
  const textoNormalizado = normalizarTexto(datos.descripcion);
  if (!textoNormalizado) return false;
  const [proveedor, producto] = await Promise.all([
    tx.fotofficeProveedor.findFirst({ where: { id: datos.proveedorId, workspaceId: datos.workspaceId }, select: { id: true } }),
    tx.product.findFirst({ where: { id: datos.productId, workspaceId: datos.workspaceId, isActive: true }, select: { id: true } }),
  ]);
  if (!proveedor || !producto) return false;
  await tx.fotofficeAliasProveedor.upsert({
    where: { proveedorId_textoNormalizado: { proveedorId: datos.proveedorId, textoNormalizado } },
    create: { workspaceId: datos.workspaceId, proveedorId: datos.proveedorId, textoNormalizado, productId: datos.productId },
    update: { productId: datos.productId },
  });
  return true;
}
