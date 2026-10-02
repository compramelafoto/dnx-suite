import { prisma } from "@repo/db";

/**
 * El blog de una institución dentro del motor compartido de contenido (`@repo/content`).
 *
 * El motor separa por plataforma y, en FOTOFFICE, además por institución: cada workspace tiene
 * su blog, con sus artículos, categorías y autores. Todo lo que hable con el motor pasa por
 * acá para que la institución no se pueda olvidar: sin ella el motor directamente falla.
 */
export const FOTOFFICE_BLOG_PLATFORM = "fotoffice" as const;

export function blogScope(workspaceId: string) {
  return { prisma, platform: FOTOFFICE_BLOG_PLATFORM, workspaceKey: workspaceId };
}

/** El filtro de Prisma para las consultas propias (categorías, tags, autores, imágenes). */
export function blogWhere(workspaceId: string) {
  return { platform: FOTOFFICE_BLOG_PLATFORM, workspaceKey: workspaceId };
}
