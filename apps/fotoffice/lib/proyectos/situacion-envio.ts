import "server-only";
import { prisma } from "@repo/db";
import { esSkuCajaFotolibro, tipoTapaDeSku } from "@/lib/fotolibro/venta";
import { estadoDeEnvio, type EstadoEnvio } from "./estado-envio";

/**
 * Lo que hace falta saber de varios trabajos para decidir y mostrar su envío al proveedor, en
 * pocas consultas: si el material es físico, si lo manda otro camino (fotolibro o mostrador) y
 * cuántos archivos tiene listos. Ver `estado-envio.ts`.
 */

export type SituacionEnvio = {
  proyectoId: string;
  proveedor: string | null;
  envioSinArchivos: boolean;
  otroCamino: boolean;
  esFotolibro: boolean;
  esDeMostrador: boolean;
  archivosListos: number;
  enviadoAt: Date | null;
  abiertoAt: Date | null;
  descargadoAt: Date | null;
};

export function esProductoDeFotolibro(sku: string | null | undefined): boolean {
  return tipoTapaDeSku(sku) !== null || esSkuCajaFotolibro(sku);
}

export async function situacionesDeEnvio(workspaceId: string, proyectoIds: readonly string[]): Promise<Map<string, SituacionEnvio>> {
  const out = new Map<string, SituacionEnvio>();
  if (proyectoIds.length === 0) return out;
  const ids = [...new Set(proyectoIds)];
  // Consultas planas (sin selects anidados): las mismas que entiende la base en memoria de las pruebas.
  const proyectos = await prisma.fotofficeProyecto.findMany({
    where: { workspaceId, id: { in: ids } },
    select: {
      id: true,
      productId: true,
      circuitId: true,
      proveedorId: true,
      proveedorEnviadoAt: true,
      proveedorAbiertoAt: true,
      proveedorDescargadoAt: true,
    },
  });
  if (proyectos.length === 0) return out;
  const productIds = [...new Set(proyectos.map((p) => p.productId).filter((x): x is string => x !== null))];
  const proveedorIds = [...new Set(proyectos.map((p) => p.proveedorId).filter((x): x is string => x !== null))];
  const [productos, proveedores, fisicos, archivos, mostrador] = await Promise.all([
    productIds.length ? prisma.product.findMany({ where: { workspaceId, id: { in: productIds } }, select: { id: true, sku: true } }) : [],
    proveedorIds.length ? prisma.fotofficeProveedor.findMany({ where: { workspaceId, id: { in: proveedorIds } }, select: { id: true, name: true } }) : [],
    productIds.length
      ? prisma.fotofficeProductoProyecto.findMany({
          where: { workspaceId, productId: { in: productIds }, envioSinArchivos: true },
          select: { productId: true, circuitId: true },
        })
      : [],
    prisma.fotofficeArchivoTrabajo.findMany({ where: { workspaceId, proyectoId: { in: ids }, estado: "LISTO" }, select: { proyectoId: true } }),
    prisma.fotofficePrintOrderItem.findMany({ where: { proyectoId: { in: ids }, order: { workspaceId } }, select: { proyectoId: true } }),
  ]);
  const skuDe = new Map(productos.map((p) => [p.id, p.sku]));
  const nombreDe = new Map(proveedores.map((p) => [p.id, p.name]));
  const fisico = new Set(fisicos.map((f) => `${f.productId}:${f.circuitId}`));
  const listos = new Map<string, number>();
  for (const a of archivos) listos.set(a.proyectoId, (listos.get(a.proyectoId) ?? 0) + 1);
  const deMostrador = new Set(mostrador.map((m) => m.proyectoId).filter((x): x is string => x !== null));
  for (const p of proyectos) {
    const esFotolibro = esProductoDeFotolibro(p.productId ? skuDe.get(p.productId) : null);
    const esDeMostrador = deMostrador.has(p.id);
    out.set(p.id, {
      proyectoId: p.id,
      proveedor: p.proveedorId ? (nombreDe.get(p.proveedorId) ?? null) : null,
      envioSinArchivos: p.productId ? fisico.has(`${p.productId}:${p.circuitId}`) : false,
      otroCamino: esFotolibro || esDeMostrador,
      esFotolibro,
      esDeMostrador,
      archivosListos: listos.get(p.id) ?? 0,
      enviadoAt: p.proveedorEnviadoAt,
      abiertoAt: p.proveedorAbiertoAt,
      descargadoAt: p.proveedorDescargadoAt,
    });
  }
  return out;
}

/** El estado para mostrar de cada trabajo (sólo los que tienen proveedor). */
export async function estadosDeEnvio(workspaceId: string, proyectoIds: readonly string[]): Promise<Map<string, EstadoEnvio>> {
  const s = await situacionesDeEnvio(workspaceId, proyectoIds);
  const out = new Map<string, EstadoEnvio>();
  for (const [id, d] of s) {
    const e = estadoDeEnvio(d);
    if (e) out.set(id, e);
  }
  return out;
}
