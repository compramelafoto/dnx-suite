import "server-only";
import { prisma } from "@repo/db";
import { ORIGEN_ALBOOM } from "@/lib/website/redirecciones";
import { updateBlogPost } from "./admin-queries";
import { blogWhere } from "./scope";

/**
 * Los artículos que trajo el importador de Alboom quedan en BORRADOR (el blog ya es público y no
 * debían aparecer antes que el resto del sitio). Este es el paso «Publicar contenido importado».
 *
 * El blog no tiene una columna de origen (agregarla a `BlogPost` rompería las otras bases que
 * comparten el esquema), así que un artículo importado se reconoce por la redirección que dejó el
 * importador: `/post/<id>-*` → `/blog/<slug>` con origen `alboom-prosite`.
 */

const esTablaFaltante = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2021";

async function slugsImportados(workspaceId: string): Promise<string[]> {
  try {
    const filas = await prisma.fotofficeSitioRedireccion.findMany({
      where: { workspaceId, origen: ORIGEN_ALBOOM, hacia: { startsWith: "/blog/" } },
      select: { hacia: true },
    });
    return [...new Set(filas.map((f) => f.hacia.slice("/blog/".length)).filter(Boolean))];
  } catch (err) {
    if (esTablaFaltante(err)) return [];
    throw err;
  }
}

async function borradoresImportados(workspaceId: string) {
  const slugs = await slugsImportados(workspaceId);
  if (slugs.length === 0) return [];
  return prisma.blogPost.findMany({
    where: { ...blogWhere(workspaceId), status: "DRAFT", slug: { in: slugs } },
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
