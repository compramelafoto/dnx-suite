import "server-only";
import { prisma } from "@repo/db";
import { normalizarReceta, sugerirLineas, type LineaReceta } from "./receta";

/** Receta de consumo contra la base. */

export type LineaRecetaVista = LineaReceta & { insumoNombre: string; insumoUnidad: string };
export type InsumoOpcion = { id: string; nombre: string; unidad: string };

const ERROR_NO_INSUMO = "Eso no es un insumo de este negocio.";
const ERROR_PRODUCTO = "Ese producto no existe.";

export async function leerReceta(workspaceId: string, productId: string): Promise<LineaRecetaVista[]> {
  const filas = await prisma.fotofficeRecetaInsumo.findMany({
    where: { workspaceId, productId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      insumoId: true,
      quantity: true,
      porCada: true,
      insumo: { select: { name: true, fotofficeInsumo: { select: { unidad: true } } } },
    },
  });
  return filas.map((f) => ({
    insumoId: f.insumoId,
    quantity: f.quantity,
    porCada: f.porCada,
    insumoNombre: f.insumo.name,
    insumoUnidad: f.insumo.fotofficeInsumo?.unidad ?? "unidades",
  }));
}

/** Los insumos del negocio que se pueden poner en una receta. */
export async function listarInsumosParaReceta(workspaceId: string): Promise<InsumoOpcion[]> {
  const filas = await prisma.product.findMany({
    where: { workspaceId, kind: "INSUMO", isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, fotofficeInsumo: { select: { unidad: true } } },
  });
  return filas.map((f) => ({ id: f.id, nombre: f.name, unidad: f.fotofficeInsumo?.unidad ?? "unidades" }));
}

export async function guardarReceta(
  workspaceId: string,
  productId: string,
  entrada: readonly LineaReceta[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const n = normalizarReceta(productId, entrada);
  if (!n.ok) return n;
  return prisma.$transaction(async (tx) => {
    const producto = await tx.product.findFirst({ where: { id: productId, workspaceId }, select: { id: true, kind: true } });
    if (!producto) return { ok: false as const, error: ERROR_PRODUCTO };
    if (producto.kind === "INSUMO") return { ok: false as const, error: "Un insumo no lleva receta." };

    const ids = n.valor.map((l) => l.insumoId);
    if (ids.length > 0) {
      const validos = await tx.product.findMany({
        where: { id: { in: ids }, workspaceId, kind: "INSUMO" },
        select: { id: true },
      });
      if (validos.length !== new Set(ids).size) return { ok: false as const, error: ERROR_NO_INSUMO };
    }

    await tx.fotofficeRecetaInsumo.deleteMany({ where: { workspaceId, productId } });
    if (n.valor.length > 0) {
      await tx.fotofficeRecetaInsumo.createMany({
        data: n.valor.map((l, order) => ({ workspaceId, productId, insumoId: l.insumoId, quantity: l.quantity, porCada: l.porCada, order })),
      });
    }
    return { ok: true as const };
  });
}

/** Precarga, no guarda: la persona la revisa y toca «Guardar». */
export async function sugerirDesdeImpresion(
  workspaceId: string,
  productId: string,
  piezasPorHoja: number,
): Promise<LineaReceta[]> {
  const prod = await prisma.fotofficeProductoProduccion.findFirst({
    where: { workspaceId, productId },
    select: { salidaId: true, tamanoHojaId: true, unidad: true },
  });
  // El archivo digital no sale por ninguna impresora: no gasta insumos de impresión.
  if (!prod?.salidaId || !prod.tamanoHojaId) return [];
  const consumos = await prisma.fotofficeConsumoTamano.findMany({
    where: { workspaceId, salidaId: prod.salidaId, tamanoId: prod.tamanoHojaId },
    orderBy: { createdAt: "asc" },
    select: { insumoId: true, quantity: true },
  });
  return sugerirLineas({ unidad: prod.unidad as "HOJA" | "COPIA" | "PIEZA", piezasPorHoja, consumos });
}
