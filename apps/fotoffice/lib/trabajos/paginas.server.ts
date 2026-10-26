import "server-only";
import type { Metadata } from "next";
import { buildBlogMetadata } from "@/lib/blog/public-seo";
import { loadPublicSite, type PublicSite } from "@/lib/website/public-site";
import { TRABAJOS_PUBLIC_SEGMENT, WEBSITE_MODULE_KEY } from "@/lib/website/constants";

/**
 * Lo común de las páginas públicas de Trabajos. Como el blog, Trabajos es una sección del Sitio
 * web: sin el módulo encendido no existe (404). `loadPublicSite` está envuelta en `cache()`, así que
 * la metadata, la página y el layout comparten una sola lectura por request.
 */
export async function cargarSitioDeTrabajos(workspaceSlug: string): Promise<PublicSite | null> {
  const site = await loadPublicSite(workspaceSlug);
  if (!site || !site.enabledModuleKeys.has(WEBSITE_MODULE_KEY)) return null;
  return site;
}

/** `/w/<slug>/trabajos`, sin barra final. */
export function trabajosPath(workspaceSlug: string): string {
  return `/w/${workspaceSlug}/${TRABAJOS_PUBLIC_SEGMENT}`;
}

/** Metadata con el nombre de la institución, canonical absoluta y vista previa al compartir (la
 * misma pieza que el blog: para Google la página es de la institución, no de FOTOFFICE). */
export function metadataDeTrabajos(
  site: PublicSite,
  input: { title: string; description: string; path: string; imageUrl?: string | null },
): Metadata {
  return buildBlogMetadata(
    { workspaceId: site.workspaceId, slug: site.workspaceSlug, nombre: site.commercialName, logoUrl: site.logoUrl },
    { title: input.title, description: input.description, path: input.path, imageUrl: input.imageUrl },
  );
}
