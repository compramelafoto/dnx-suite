import "server-only";
import { cache } from "react";
import { prisma } from "@repo/db";
import type { SiteMetadataInput } from "./site-metadata";

/**
 * Los datos de `buildSiteMetadata` para una institución. Select acotado: todo esto termina en el
 * HTML público. El título y la descripción de SEO salen de la versión PUBLICADA, no del borrador.
 */
export const loadSiteMetadataInput = cache(async function loadSiteMetadataInput(
  workspaceSlug: string,
): Promise<SiteMetadataInput | null> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: {
      workspaceId: true,
      commercialName: true,
      shortDescription: true,
      logoUrl: true,
      coverImageUrl: true,
      faviconUrl: true,
    },
  });
  if (!branding) return null;

  const website = await prisma.fotofficeWorkspaceWebsite.findUnique({
    where: { workspaceId: branding.workspaceId },
    select: { publishedVersion: { select: { seoTitle: true, seoDescription: true } } },
  });

  return {
    commercialName: branding.commercialName,
    seoTitle: website?.publishedVersion?.seoTitle ?? null,
    seoDescription: website?.publishedVersion?.seoDescription ?? null,
    shortDescription: branding.shortDescription,
    logoUrl: branding.logoUrl,
    coverImageUrl: branding.coverImageUrl,
    faviconUrl: branding.faviconUrl,
  };
});
