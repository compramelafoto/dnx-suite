import { prisma, withClickatonDb } from "@/lib/admin/db";
import type { HomeBannerRecord } from "./types";

const select = {
  id: true,
  title: true,
  eyebrow: true,
  description: true,
  ctaLabel: true,
  linkType: true,
  href: true,
  editionId: true,
  imageUrl: true,
  imageUrlVertical: true,
  sortOrder: true,
  isActive: true,
  publishedAt: true,
  edition: { select: { id: true, name: true, slug: true } },
} as const;

export async function listHomeBanners() {
  return withClickatonDb(async () => {
    const rows = await prisma.clickatonHomeBanner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select,
    });
    return rows as HomeBannerRecord[];
  });
}

export async function getHomeBannerById(id: string) {
  return withClickatonDb(async () => {
    const row = await prisma.clickatonHomeBanner.findUnique({
      where: { id },
      select,
    });
    return (row as HomeBannerRecord | null) ?? null;
  });
}

/** Banners activos para el home público. */
export async function listActiveHomeBannersForPublic() {
  return withClickatonDb(async () => {
    const now = new Date();
    return prisma.clickatonHomeBanner.findMany({
      where: {
        isActive: true,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        ...select,
        edition: {
          select: {
            id: true,
            name: true,
            slug: true,
            coverImageUrl: true,
            coverImageVerticalUrl: true,
            shortDescription: true,
            registrationEnabled: true,
            isPublished: true,
            city: true,
          },
        },
      },
    });
  });
}
