import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { categoriaActiva, categoriaParaEventType, type CategoriaElegida } from "@/lib/consultas/categorias";
import { origenesPublicos, type OpcionPublica } from "@/lib/consultas/formulario-publico";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * La categoría con la que entra una consulta del formulario del sitio (bloque INQUIRY_FORM y
 * página «Pedí tu presupuesto»). El formulario NUNCA pierde una consulta por la categoría:
 *   1. la elegida, si sigue activa en este workspace;
 *   2. si no (se archivó después de publicar, o vino otra cosa), la equivalente por tipo viejo:
 *      el `eventType` que se pase o, si no, el de la categoría elegida aunque esté archivada;
 *   3. si no, la activa que se llame «Otro», «Otros», «Otro evento»…;
 *   4. si no, la primera activa.
 * Los pasos 2–4 son los de `categoriaParaEventType`. Devuelve siempre una categoría ACTIVA (el
 * alta rechaza las archivadas) o null si el workspace no tiene ninguna.
 */
export async function resolverCategoriaDelSitio(
  db: Db,
  workspaceId: string,
  categoriaId: string | null,
  eventType: string | null,
): Promise<CategoriaElegida | null> {
  const elegida = await categoriaActiva(db, workspaceId, categoriaId);
  if (elegida) return elegida;

  let tipo = eventType;
  if (!tipo && typeof categoriaId === "string" && categoriaId && categoriaId.length <= 100) {
    const archivada = await db.fotofficeConsultaCategoria.findFirst({
      where: { id: categoriaId, workspaceId },
      select: { legacyEventType: true },
    });
    tipo = archivada?.legacyEventType ?? null;
  }
  const reemplazo = await categoriaParaEventType(db, workspaceId, tipo);
  if (!reemplazo) return null;
  return { id: reemplazo.id, name: reemplazo.name, group: reemplazo.group, legacyEventType: reemplazo.legacyEventType };
}

/** Lo que el formulario del sitio ofrece: categorías y orígenes activos, sólo id y nombre. */
export type OpcionesDelFormulario = { categorias: OpcionPublica[]; origenes: OpcionPublica[] };

/** Las categorías activas del workspace, en su orden. Sólo id y nombre. */
export async function categoriasActivasPublicas(workspaceId: string, db: Db = prisma): Promise<OpcionPublica[]> {
  const filas = await db.fotofficeConsultaCategoria.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    take: 500,
    select: { id: true, name: true },
  });
  return filas.map((c) => ({ id: c.id, nombre: c.name }));
}

export async function opcionesDelFormulario(workspaceId: string, db: Db = prisma): Promise<OpcionesDelFormulario> {
  const [categorias, origenes] = await Promise.all([categoriasActivasPublicas(workspaceId, db), origenesPublicos(workspaceId, db)]);
  return { categorias, origenes };
}
