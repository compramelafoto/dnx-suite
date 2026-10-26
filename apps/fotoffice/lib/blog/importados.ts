import "server-only";
import { prisma } from "@repo/db";
import { PREFIJO_ARTICULO_IMPORTADO } from "@/lib/website/redirecciones-reglas";
import { updateBlogPost } from "./admin-queries";
import { blogWhere } from "./scope";

/**
 * Los artículos que trajo el importador de Alboom quedan en BORRADOR (el blog ya es público y no
 * debían aparecer antes que el resto del sitio). Este es el paso «Publicar contenido importado».
 *
 * El blog no tiene una columna de origen (agregarla a `BlogPost` rompería las otras bases que
 * comparten el esquema). Cuando el importador CREA un artículo, deja la redirección
 * `/post.php?id=<n>` con origen `alboom-prosite:post=<id del artículo>`: se publican sólo esos ids.
 * Un borrador que ya existía con el mismo slug (el importador no lo creó) nunca se toca.
 */

const esTablaFaltante = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2021";

async function idsImportados(workspaceId: string): Promise<number[]> {
  try {
    const filas = await prisma.fotofficeSitioRedireccion.findMany({
      where: { workspaceId, origen: { startsWith: PREFIJO_ARTICULO_IMPORTADO } },
      select: { origen: true },
    });
    const ids = filas.map((f) => Number(f.origen?.slice(PREFIJO_ARTICULO_IMPORTADO.length))).filter((n) => Number.isInteger(n) && n > 0);
    return [...new Set(ids)];
  } catch (err) {
    if (esTablaFaltante(err)) return [];
    throw err;
  }
}

async function borradoresImportados(workspaceId: string) {
  const ids = await idsImportados(workspaceId);
  if (ids.length === 0) return [];
  return prisma.blogPost.findMany({
    where: { ...blogWhere(workspaceId), status: "DRAFT", id: { in: ids } },
    select: { id: true },
  });
}

/** Cuántos artículos importados siguen en borrador (el botón sólo aparece si hay alguno). */
export async function contarBorradoresImportados(workspaceId: string): Promise<number> {
  return (await borradoresImportados(workspaceId)).length;
}

/** Publica los artículos importados que siguen en borrador, con su fecha original. */
export async function publicarBorradoresImportados(workspaceId: string): Promise<number> {
  let publicados = 0;
  for (const { id } of await borradoresImportados(workspaceId)) {
    // Sólo el estado: la fecha de publicación es la de Alboom y el motor la conserva.
    if (await updateBlogPost(workspaceId, id, { status: "PUBLISHED" } as Parameters<typeof updateBlogPost>[2])) publicados++;
  }
  return publicados;
}
