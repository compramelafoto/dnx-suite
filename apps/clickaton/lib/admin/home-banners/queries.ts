import { homeContent } from "@/content/home";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import {
  DEFAULT_HOME_BANNER_CAROUSEL,
  type HomeBannerCarouselConfig,
  type HomeBannerRecord,
} from "./types";
import {
  DEFAULT_SYSTEM_SLIDES_CONFIG,
  orderByIds,
  parseSystemSlidesConfig,
  type SystemSlideAdminRow,
  type SystemSlidesConfig,
} from "./system-slides";

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

function clampCarouselConfig(raw: {
  autoplayEnabled: boolean;
  autoplayMs: number;
  transitionMs: number;
}): HomeBannerCarouselConfig {
  const autoplayMs = Math.min(30_000, Math.max(1000, Math.round(raw.autoplayMs) || 2000));
  const transitionMs = Math.min(2000, Math.max(200, Math.round(raw.transitionMs) || 700));
  return {
    autoplayEnabled: Boolean(raw.autoplayEnabled),
    autoplayMs,
    transitionMs,
  };
}

/** Config del carousel (defaults si aún no hay fila en DB). */
export async function getHomeBannerCarouselSettings() {
  return withClickatonDb(async () => {
    const row = await prisma.clickatonHomeBannerSettings.findUnique({
      where: { id: "default" },
      select: { autoplayEnabled: true, autoplayMs: true, transitionMs: true },
    });
    if (!row) return DEFAULT_HOME_BANNER_CAROUSEL;
    return clampCarouselConfig(row);
  });
}

export async function getSystemSlidesConfig() {
  return withClickatonDb(async () => {
    const row = await prisma.clickatonHomeBannerSettings.findUnique({
      where: { id: "default" },
      select: { systemSlidesConfig: true },
    });
    if (!row) return { ...DEFAULT_SYSTEM_SLIDES_CONFIG };
    return parseSystemSlidesConfig(row.systemSlidesConfig);
  });
}

/** Filas admin: ediciones publicadas + novedades estáticas, con estado/orden. */
export async function listSystemSlidesForAdmin() {
  return withClickatonDb(async () => {
    const [settings, editions] = await Promise.all([
      prisma.clickatonHomeBannerSettings.findUnique({
        where: { id: "default" },
        select: { systemSlidesConfig: true },
      }),
      prisma.clickatonEdition.findMany({
        where: { isPublished: true, isOpsFixture: false },
        select: { id: true, name: true, slug: true, city: true },
        orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
      }),
    ]);
    const config = parseSystemSlidesConfig(settings?.systemSlidesConfig);
    const editionRows: SystemSlideAdminRow[] = orderByIds(
      editions,
      config.editionOrder,
      (e) => e.id,
    ).map((e) => ({
      id: e.id,
      kind: "edition" as const,
      title: e.name,
      subtitle: e.city ? `Edición · ${e.city}` : `Edición · /${e.slug}`,
      isEnabled: config.editionsEnabled && !config.disabledEditionIds.includes(e.id),
    }));
    const newsSource = homeContent.spotlightNews.map((n) => ({
      id: n.id,
      title: n.title,
      eyebrow: n.eyebrow,
    }));
    const newsRows: SystemSlideAdminRow[] = orderByIds(
      newsSource,
      config.newsOrder,
      (n) => n.id,
    ).map((n) => ({
      id: n.id,
      kind: "news" as const,
      title: n.title,
      subtitle: n.eyebrow ? `Novedad · ${n.eyebrow}` : "Novedad del sistema",
      isEnabled: config.newsEnabled && !config.disabledNewsIds.includes(n.id),
    }));
    return { config, editions: editionRows, news: newsRows };
  });
}
