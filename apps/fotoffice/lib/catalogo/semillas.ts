import "server-only";
import { prisma } from "@repo/db";
import { esSlugDnx } from "@/lib/slug-dnx";
import { CATEGORIAS_PRODUCTO_DNX, categoriasFaltantes } from "./reglas";

/**
 * Las 11 categorías de producto de DNX Estudio como categorías del catálogo de Ventas
 * (spec §3.1). Sólo para DNX y sólo las que faltan, comparando el nombre sin mayúsculas: si ya
 * hay una "evento" o una inactiva "Álbum", no se duplica ni se reactiva.
 *
 * Idempotente: el único (workspaceId, name) frena una corrida simultánea (`skipDuplicates`).
 * Devuelve cuántas creó.
 */
export async function asegurarCategoriasProductoDnx(workspaceId: string, slug: string | null | undefined): Promise<number> {
  if (!esSlugDnx(slug)) return 0;
  const existentes = await prisma.productCategory.findMany({ where: { workspaceId }, select: { name: true, order: true } });
  const faltan = categoriasFaltantes(existentes.map((c) => c.name), CATEGORIAS_PRODUCTO_DNX);
  if (faltan.length === 0) return 0;
  const desde = existentes.reduce((m, c) => Math.max(m, c.order), -1) + 1;
  const r = await prisma.productCategory.createMany({
    data: faltan.map((name, i) => ({ workspaceId, name, order: desde + i })),
    skipDuplicates: true,
  });
  return r.count;
}
