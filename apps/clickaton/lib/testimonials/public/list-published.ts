import "server-only";

/**
 * Lo que el sitio público lee de los testimonios.
 *
 * Esta consulta NUNCA incluye `surveyResponse`: la crítica constructiva vive
 * ahí y no tiene por qué viajar hasta una página pública, ni siquiera dentro
 * de un objeto que después se descarta.
 */
import { prisma } from "@repo/db";
import type { ClickatonTestimonialAuthorRole } from "../domain/types";
import { buildExcerpt } from "../domain/excerpt";
import { testimonialPhotoPath } from "./voices-presentation";

export type PublishedTestimonial = {
  id: string;
  excerpt: string;
  authorName: string;
  authorRole: ClickatonTestimonialAuthorRole;
  editionName: string;
  photoUrl: string | null;
  linkUrl: string | null;
};

export async function listPublishedTestimonials(options?: {
  editionId?: string;
  limit?: number;
}): Promise<PublishedTestimonial[]> {
  const rows = await prisma.clickatonTestimonial.findMany({
    where: {
      status: "PUBLISHED",
      publicationConsent: true,
      ...(options?.editionId ? { editionId: options.editionId } : {}),
      edition: { isOpsFixture: false },
    },
    select: {
      id: true,
      quote: true,
      highlightedExcerpt: true,
      authorName: true,
      authorRole: true,
      authorPhotoAssetId: true,
      authorLinkUrl: true,
      edition: { select: { name: true } },
    },
    orderBy: [
      { isFeatured: "desc" },
      { displayOrder: "asc" },
      { publishedAt: "desc" },
    ],
    take: options?.limit ?? 12,
  });

  return rows.map((row) => ({
    id: row.id,
    excerpt: row.highlightedExcerpt?.trim() || buildExcerpt(row.quote),
    authorName: row.authorName,
    authorRole: row.authorRole,
    editionName: row.edition.name,
    photoUrl: row.authorPhotoAssetId ? testimonialPhotoPath(row.id) : null,
    linkUrl: row.authorLinkUrl,
  }));
}
