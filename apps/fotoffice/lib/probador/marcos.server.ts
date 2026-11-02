import "server-only";
import { prisma } from "@repo/db";
import { cargarCatalogoProbador } from "./catalogo.server";
import { armarMarcos, colorDeVariante, esProductoMarco, medidasDeMarco, type MarcoServidor, type ModeloMarco, type ProductoMarco } from "./marcos";

/** Los productos de un estudio que son marcos para fotos, con sus variantes. */
export async function productosMarco(workspaceId: string, ids?: string[]): Promise<ProductoMarco[]> {
  const filas = await prisma.product.findMany({
    where: { workspaceId, isActive: true, ...(ids ? { id: { in: ids } } : {}) },
    select: { id: true, name: true, priceArs: true, costArs: true, variants: { select: { id: true, name: true, priceArs: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });
  return filas
    .filter((p) => ids || esProductoMarco(p.name))
    .map((p) => ({
      id: p.id,
      name: p.name,
      priceArs: Number(p.priceArs),
      costArs: p.costArs == null ? null : Number(p.costArs),
      variantes: p.variants.map((v) => ({ id: v.id, name: v.name, priceArs: v.priceArs == null ? null : Number(v.priceArs) })),
    }));
}

export async function modelosDeMarco(workspaceId: string, soloActivos: boolean): Promise<(ModeloMarco & { activo: boolean })[]> {
  const filas = await prisma.fotofficeModeloMarco.findMany({ where: { workspaceId, ...(soloActivos ? { activo: true } : {}) }, orderBy: { createdAt: "asc" } });
  return filas.map((f) => ({
    id: f.id, productId: f.productId, color: f.color, imagenUrl: f.imagenUrl, imagenAncho: f.imagenAncho, imagenAlto: f.imagenAlto,
    ventana: { x: f.ventanaX, y: f.ventanaY, w: f.ventanaW, h: f.ventanaH },
    exteriorAnchoCm: f.exteriorAnchoCm, exteriorAltoCm: f.exteriorAltoCm, activo: f.activo,
  }));
}

/** Los marcos que ofrece el probador: los modelos activos, con medidas y precio (marco + ampliación). */
export async function cargarMarcos(workspaceId: string): Promise<MarcoServidor[]> {
  const modelos = await modelosDeMarco(workspaceId, true);
  if (!modelos.length) return [];
  const [productos, catalogo] = await Promise.all([
    productosMarco(workspaceId, [...new Set(modelos.map((m) => m.productId))]),
    cargarCatalogoProbador(workspaceId),
  ]);
  return armarMarcos(productos, modelos, catalogo);
}

/** Para la pantalla de carga: cada producto marco con sus colores y lo que ya está cargado. */
export async function marcosParaCargar(workspaceId: string) {
  const [productos, modelos] = await Promise.all([productosMarco(workspaceId), modelosDeMarco(workspaceId, false)]);
  return productos.map((p) => {
    const colores = [...new Set((p.variantes.length ? p.variantes.map((v) => colorDeVariante(v.name)) : ["Único"]))];
    return {
      productoId: p.id,
      nombre: p.name,
      colores: colores.map((color) => {
        const variantes = p.variantes.filter((v) => colorDeVariante(v.name) === color);
        const medidas = (variantes.length ? variantes : [{ name: "" }]).map((v) => medidasDeMarco(p.name, v.name)).filter((m) => m !== null);
        const modelo = modelos.find((m) => m.productId === p.id && m.color === color) ?? null;
        return { color, medidas, modelo };
      }),
    };
  });
}
