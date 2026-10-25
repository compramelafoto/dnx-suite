import "server-only";
import { prisma } from "@repo/db";
import { formatBlogDate } from "@/lib/blog/public-format";
import { pickPublishedHomeBlocks } from "@/lib/website/public-site";
import { isBlogBannerActive, mainHeroBlockId } from "@/lib/website/blog-banner";

/** Lo que muestra el panel "Banner principal" del editor de un artículo. */
export type BlogBannerPanelData = {
  /** La placa de este artículo, vigente o ya vencida. `null` = nunca estuvo en el banner. */
  slot: { position: number; durationDays: number; active: boolean; endsLabel: string } | null;
  /** Placas propias del banner publicado. `null` = sitio sin publicar o sin banner. */
  ownSlideCount: number | null;
  /** Otros artículos que hoy ocupan una placa, para no pisarse sin saberlo. */
  others: { title: string; position: number; endsLabel: string }[];
};

function endsLabel(endsAt: Date): string {
  return formatBlogDate(endsAt) ?? "";
}

export async function loadBlogBannerPanel(workspaceId: string, postId: number): Promise<BlogBannerPanelData> {
  const now = new Date();
  const [slot, others, website] = await Promise.all([
    prisma.fotofficeBlogBannerSlot.findFirst({
      where: { workspaceId, postId },
      select: { position: true, durationDays: true, startsAt: true, endsAt: true },
    }),
    prisma.fotofficeBlogBannerSlot.findMany({
      where: { workspaceId, postId: { not: postId }, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { position: true, endsAt: true, post: { select: { title: true } } },
    }),
    prisma.fotofficeWorkspaceWebsite.findUnique({
      where: { workspaceId },
      select: { publishedVersion: { select: { sectionsJson: true } } },
    }),
  ]);

  const { homeBlocks } = pickPublishedHomeBlocks({
    websiteModuleEnabled: true,
    publishedSectionsJson: website?.publishedVersion?.sectionsJson ?? null,
  });
  const heroId = mainHeroBlockId(homeBlocks);
  const hero = homeBlocks.find((b) => b.id === heroId);

  return {
    slot: slot
      ? {
          position: slot.position,
          durationDays: slot.durationDays,
          active: isBlogBannerActive(slot, now),
          endsLabel: endsLabel(slot.endsAt),
        }
      : null,
    ownSlideCount: hero?.type === "HERO" ? hero.config.slides.length : null,
    others: others.map((o) => ({ title: o.post.title, position: o.position, endsLabel: endsLabel(o.endsAt) })),
  };
}
