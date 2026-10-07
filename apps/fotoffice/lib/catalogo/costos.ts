import "server-only";
import { prisma } from "@repo/db";
import { clientDisplayName } from "@/lib/clients/display";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { NO_EXISTE, type ResultadoCatalogo } from "./perfil";
import { normalizarCostos, type CostoEntrada } from "./reglas";

/**
 * Costos-plantilla de un producto: lo que cuesta venderlo (laboratorio, segundo fotógrafo,
 * viáticos), con proveedor, concepto, importe fijo o por unidad y días desde el evento.
 * Sólo se registran: los pagos llegan con la etapa 3.
 *
 * El proveedor es opcional; si está, tiene que ser un contacto (`Client`) del MISMO workspace.
 * La ficha ofrece los de categoría Proveedor (etapa 1), pero cualquier contacto propio vale.
 *
 * Son costos: los ve sólo quien tiene `sales.catalog` (la ficha entera lo exige).
 */

export type CostoDetalle = CostoEntrada & { id: string; supplierName: string | null };

export type ProveedorOpcion = { id: string; name: string };

export async function leerCostos(workspaceId: string, productId: string): Promise<CostoDetalle[]> {
  const filas = await prisma.fotofficeCostoPlantilla.findMany({
    where: { workspaceId, productId },
    orderBy: [{ order: "asc" }],
    select: { id: true, supplierClientId: true, concept: true, amountArs: true, perUnit: true, daysFromEvent: true },
  });
  const ids = [...new Set(filas.map((f) => f.supplierClientId).filter((x): x is string => !!x))];
  const proveedores = ids.length
    ? await prisma.client.findMany({
        where: { workspaceId, id: { in: ids } },
        select: { id: true, kind: true, firstName: true, lastName: true, businessName: true },
      })
    : [];
  const nombre = new Map(proveedores.map((p) => [p.id, clientDisplayName(p)]));
  return filas.map((f) => ({
    id: f.id,
    // Un proveedor de otro workspace (fila mal cargada) se muestra como "sin proveedor".
    supplierClientId: f.supplierClientId && nombre.has(f.supplierClientId) ? f.supplierClientId : null,
    supplierName: f.supplierClientId ? (nombre.get(f.supplierClientId) ?? null) : null,
    concept: f.concept,
    amountMinor: decimalArsToMinor(f.amountArs),
    perUnit: f.perUnit,
    daysFromEvent: f.daysFromEvent,
  }));
}

/** Los contactos de categoría Proveedor del workspace, por nombre. */
export async function proveedoresDelWorkspace(workspaceId: string): Promise<ProveedorOpcion[]> {
  const perfiles = await prisma.fotofficeContactoPerfil.findMany({
    where: { workspaceId, category: "PROVEEDOR" },
    select: { clientId: true },
  });
  if (perfiles.length === 0) return [];
  const clientes = await prisma.client.findMany({
    where: { workspaceId, id: { in: perfiles.map((p) => p.clientId) } },
    select: { id: true, kind: true, firstName: true, lastName: true, businessName: true },
    take: 1000,
  });
  return clientes
    .map((c) => ({ id: c.id, name: clientDisplayName(c) }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function guardarCostos(workspaceId: string, productId: string, entrada: readonly unknown[]): Promise<ResultadoCatalogo> {
  const normal = normalizarCostos(entrada);
  if (!normal.ok) return normal;
  const costos = normal.valor;

  return prisma.$transaction(async (tx) => {
    // Candado por producto: dos guardados a la vez no intercalan su borrar-y-crear.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-costos:${workspaceId}:${productId}`}))`;
    const producto = await tx.product.findFirst({ where: { id: productId, workspaceId }, select: { id: true } });
    if (!producto) return NO_EXISTE;

    const proveedores = [...new Set(costos.map((c) => c.supplierClientId).filter((x): x is string => !!x))];
    if (proveedores.length > 0) {
      const propios = await tx.client.findMany({ where: { workspaceId, id: { in: proveedores } }, select: { id: true } });
      if (propios.length !== proveedores.length) return { ok: false, error: "Uno de los proveedores no es un contacto tuyo." };
    }

    await tx.fotofficeCostoPlantilla.deleteMany({ where: { workspaceId, productId } });
    if (costos.length > 0) {
      await tx.fotofficeCostoPlantilla.createMany({
        data: costos.map((c, order) => ({
          workspaceId,
          productId,
          supplierClientId: c.supplierClientId,
          concept: c.concept,
          amountArs: minorToDecimalString(c.amountMinor),
          perUnit: c.perUnit,
          daysFromEvent: c.daysFromEvent,
          order,
        })),
      });
    }
    return { ok: true } as const;
  });
}
