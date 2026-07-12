/**
 * Dry-run: proyecta soft refs Article.eventId / clfAlbumId → InfoSpotContentOrigin.
 * No escribe nada cuando dryRun=true (default).
 */

import { prisma } from "@repo/db";
import { normalizeClfExternalIdentity } from "./adapters/compramelafoto";
import { comprameLaFotoAdapter } from "./adapters/compramelafoto";
import { linkArticleToOrigin } from "./service";

export type SoftRefBackfillReport = {
  dryRun: boolean;
  articlesScanned: number;
  withEventId: number;
  withAlbumId: number;
  wouldCreateEventLinks: number;
  wouldCreateAlbumLinks: number;
  alreadyLinkedEvent: number;
  alreadyLinkedAlbum: number;
  samples: Array<{
    articleId: string;
    slug: string;
    eventId: number | null;
    clfAlbumId: number | null;
    actions: string[];
  }>;
};

export async function dryRunBackfillSoftRefsToContentOrigin(options?: {
  dryRun?: boolean;
  take?: number;
}): Promise<SoftRefBackfillReport> {
  const dryRun = options?.dryRun !== false;
  const take = options?.take ?? 500;

  const articles = await prisma.infoSpotArticle.findMany({
    where: {
      OR: [{ eventId: { not: null } }, { clfAlbumId: { not: null } }],
    },
    select: {
      id: true,
      slug: true,
      eventId: true,
      clfAlbumId: true,
      sourceUrl: true,
    },
    take,
    orderBy: { updatedAt: "desc" },
  });

  let wouldCreateEventLinks = 0;
  let wouldCreateAlbumLinks = 0;
  let alreadyLinkedEvent = 0;
  let alreadyLinkedAlbum = 0;
  let withEventId = 0;
  let withAlbumId = 0;
  const samples: SoftRefBackfillReport["samples"] = [];

  for (const article of articles) {
    const actions: string[] = [];
    if (article.eventId != null) {
      withEventId += 1;
      const identity = normalizeClfExternalIdentity("EVENT", article.eventId);
      const existing = await prisma.infoSpotContentOrigin.findFirst({
        where: {
          articleId: article.id,
          sourceType: identity.sourceType,
          externalEntityType: identity.externalEntityType,
          externalId: identity.externalId,
        },
        select: { id: true },
      });
      if (existing) {
        alreadyLinkedEvent += 1;
        actions.push("event_already_linked");
      } else {
        wouldCreateEventLinks += 1;
        actions.push("would_link_event");
        if (!dryRun) {
          await linkArticleToOrigin(article.id, {
            sourceType: "COMPRAMELAFOTO",
            externalEntityType: "EVENT",
            externalId: article.eventId,
            externalUrl: comprameLaFotoAdapter.resolveExternalUrl({
              externalEntityType: "EVENT",
              externalId: article.eventId,
            }),
            direction: "INBOUND",
            syncStatus: "SYNCED",
            operationalPayload: { softRefBackfill: true, eventId: article.eventId },
          });
        }
      }
    }

    if (article.clfAlbumId != null) {
      withAlbumId += 1;
      const identity = normalizeClfExternalIdentity("ALBUM", article.clfAlbumId);
      const existing = await prisma.infoSpotContentOrigin.findFirst({
        where: {
          articleId: article.id,
          sourceType: identity.sourceType,
          externalEntityType: identity.externalEntityType,
          externalId: identity.externalId,
        },
        select: { id: true },
      });
      if (existing) {
        alreadyLinkedAlbum += 1;
        actions.push("album_already_linked");
      } else {
        wouldCreateAlbumLinks += 1;
        actions.push("would_link_album");
        if (!dryRun) {
          await linkArticleToOrigin(article.id, {
            sourceType: "COMPRAMELAFOTO",
            externalEntityType: "ALBUM",
            externalId: article.clfAlbumId,
            externalUrl: article.sourceUrl,
            direction: "INBOUND",
            syncStatus: "SYNCED",
            operationalPayload: {
              softRefBackfill: true,
              albumId: article.clfAlbumId,
            },
          });
        }
      }
    }

    if (samples.length < 15) {
      samples.push({
        articleId: article.id,
        slug: article.slug,
        eventId: article.eventId,
        clfAlbumId: article.clfAlbumId,
        actions,
      });
    }
  }

  return {
    dryRun,
    articlesScanned: articles.length,
    withEventId,
    withAlbumId,
    wouldCreateEventLinks,
    wouldCreateAlbumLinks,
    alreadyLinkedEvent,
    alreadyLinkedAlbum,
    samples,
  };
}
