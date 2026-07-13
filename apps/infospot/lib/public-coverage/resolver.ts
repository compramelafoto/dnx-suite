/**
 * Resolver central: PublicEditorialCoverage por slug de artículo.
 * Una carga, sin N+1 por nodo TipTap.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@repo/db";
import { publicPublishedArticleWhere, publicPublishedEventWhere } from "../distribution/public-rules";
import { getEventTemporalState, temporalStateLabel } from "../distribution/temporal";
import { resolvePhotographerCallFromSources } from "../distribution/photographer-call";
import { buildTrackedHref } from "./tracking-href";
import { toPublicEditorialPhoto } from "./photo-mapper";
import type {
  PublicCoverageAlbum,
  PublicEditorialCoverage,
  PublicEditorialPhotoViewModel,
  PublicRelatedArticle,
  PublicRelatedEvent,
} from "./types";

async function resolveUncached(slug: string): Promise<PublicEditorialCoverage | null> {
  const article = await prisma.infoSpotArticle.findFirst({
    where: { slug, ...publicPublishedArticleWhere() },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      eventId: true,
      clfAlbumId: true,
      coverImage: { select: { url: true, credit: true } },
      categoryId: true,
      category: { select: { id: true, slug: true } },
      editorialPhotoUsages: {
        orderBy: [{ usageType: "asc" }, { sortOrder: "asc" }],
        include: {
          photo: {
            include: {
              variants: true,
            },
          },
        },
      },
      coverageLinks: {
        include: {
          coverage: {
            include: {
              photographers: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!article) return null;

  const ctx = { articleId: article.id, eventId: null as string | null };

  const photos: PublicEditorialPhotoViewModel[] = article.editorialPhotoUsages.map((u) =>
    toPublicEditorialPhoto(
      {
        usageType: u.usageType,
        sortOrder: u.sortOrder,
        caption: u.caption,
        altText: u.altText,
        displaySize: u.displaySize,
        photo: u.photo,
      },
      ctx,
    ),
  );

  const photoById: Record<string, PublicEditorialPhotoViewModel> = {};
  for (const p of photos) photoById[p.id] = p;

  const coverPhoto =
    photos.find((p) => p.usageType === "COVER") || null;
  const inlinePhotos = photos.filter((p) => p.usageType === "INLINE");
  const galleryPhotos = photos
    .filter((p) => p.usageType === "GALLERY")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const featuredPhotos = photos.filter((p) => p.usageType === "FEATURED");

  // Evento InfoSpot vinculado (por coverage / soft CLF eventId / ContentOrigin)
  let eventVm: PublicEditorialCoverage["event"] = null;
  const coverageLink = article.coverageLinks[0]?.coverage ?? null;

  type LinkedEventRow = {
    id: string;
    title: string;
    slug: string;
    city: string;
    province: string;
    startAt: Date;
    endAt: Date | null;
    registrationUrl: string | null;
    categoryId: string | null;
    photographerCall: Parameters<
      typeof resolvePhotographerCallFromSources
    >[0]["photographerCall"];
    contentOrigins: Array<{
      externalUrl: string | null;
      externalId: string;
      operationalPayload: unknown;
    }>;
  };

  let infoSpotEvent: LinkedEventRow | null = null;

  async function loadLinkedEvent(eventId: string): Promise<LinkedEventRow | null> {
    return prisma.infoSpotEvent.findFirst({
      where: { id: eventId, ...publicPublishedEventWhere() },
      include: {
        contentOrigins: {
          where: { sourceType: "COMPRAMELAFOTO", externalEntityType: "EVENT" },
          take: 1,
        },
        photographerCall: true,
      },
    });
  }

  if (coverageLink?.clfEventId) {
    const origin = await prisma.infoSpotContentOrigin.findFirst({
      where: {
        contentType: "EVENT",
        sourceType: "COMPRAMELAFOTO",
        externalEntityType: "EVENT",
        externalId: String(coverageLink.clfEventId),
      },
      select: { eventId: true },
    });
    if (origin?.eventId) {
      infoSpotEvent = await loadLinkedEvent(origin.eventId);
    }
  }

  if (!infoSpotEvent && article.eventId) {
    const origin = await prisma.infoSpotContentOrigin.findFirst({
      where: {
        contentType: "EVENT",
        sourceType: "COMPRAMELAFOTO",
        externalEntityType: "EVENT",
        externalId: String(article.eventId),
      },
      select: { eventId: true },
    });
    if (origin?.eventId) {
      infoSpotEvent = await loadLinkedEvent(origin.eventId);
    }
  }

  if (infoSpotEvent) {
    ctx.eventId = infoSpotEvent.id;
    const temporal = getEventTemporalState({
      startAt: infoSpotEvent.startAt,
      endAt: infoSpotEvent.endAt,
    });
    const call = resolvePhotographerCallFromSources({
      registrationUrl: infoSpotEvent.registrationUrl,
      photographerCall: infoSpotEvent.photographerCall,
      origin: infoSpotEvent.contentOrigins[0]
        ? {
            externalUrl: infoSpotEvent.contentOrigins[0].externalUrl,
            externalId: infoSpotEvent.contentOrigins[0].externalId,
            operationalPayload: infoSpotEvent.contentOrigins[0].operationalPayload,
          }
        : null,
    });
    eventVm = {
      id: infoSpotEvent.id,
      title: infoSpotEvent.title,
      slug: infoSpotEvent.slug,
      city: infoSpotEvent.city,
      province: infoSpotEvent.province,
      startAt: infoSpotEvent.startAt,
      temporalLabel: temporalStateLabel(temporal),
      registrationUrl: infoSpotEvent.registrationUrl,
      seekingPhotographers: call.eligible,
      joinHref:
        call.eligible && call.joinUrl
          ? buildTrackedHref({
              to: call.joinUrl,
              kind: "CLF_REGISTRATION_CLICK",
              articleId: article.id,
              eventId: infoSpotEvent.id,
            })
          : null,
    };
  }

  // Fotógrafos
  const photographers =
    coverageLink?.photographers.map((p) => ({
      clfUserId: p.clfUserId,
      displayName: p.displayName,
      role: p.role,
      photoCount: p.photoCount,
      albumHref:
        coverageLink.publicUrl && coverageLink.canShowPurchaseCta
          ? buildTrackedHref({
              to: coverageLink.publicUrl,
              kind: "ALBUM_CLICK",
              articleId: article.id,
              eventId: ctx.eventId,
            })
          : null,
      profileHref: null as string | null,
    })) ??
    Array.from(
      new Map(
        photos.map((p) => [
          p.photographerName,
          {
            clfUserId: 0,
            displayName: p.photographerName,
            role: "CONTRIBUTOR",
            photoCount: 1,
            albumHref: p.albumHref,
            profileHref: p.photographerProfileHref,
          },
        ]),
      ).values(),
    );

  // Álbumes AVAILABLE
  const albums: PublicCoverageAlbum[] = [];
  if (coverageLink && coverageLink.commercialStatus === "AVAILABLE" && coverageLink.publicUrl) {
    albums.push({
      clfAlbumId: coverageLink.clfAlbumId,
      title: coverageLink.title,
      publicUrl: coverageLink.publicUrl,
      commercialStatus: coverageLink.commercialStatus,
      canShowPurchaseCta: coverageLink.canShowPurchaseCta,
      photographerName: photographers[0]?.displayName ?? null,
      photoCount: coverageLink.photoCount,
      trackedAlbumHref: buildTrackedHref({
        to: coverageLink.publicUrl,
        kind: "ALBUM_CLICK",
        articleId: article.id,
        eventId: ctx.eventId,
      }),
      trackedPurchaseHref: coverageLink.canShowPurchaseCta
        ? buildTrackedHref({
            to: coverageLink.publicUrl,
            kind: "PURCHASE_CLICK",
            articleId: article.id,
            eventId: ctx.eventId,
          })
        : null,
    });
  } else if (article.clfAlbumId) {
    // Snapshot desde fotos editoriales
    const firstWithAlbum = article.editorialPhotoUsages.find(
      (u) => u.photo.albumUrl && u.photo.commercialStatus === "AVAILABLE",
    );
    if (firstWithAlbum?.photo.albumUrl) {
      albums.push({
        clfAlbumId: article.clfAlbumId,
        title: "Álbum de la cobertura",
        publicUrl: firstWithAlbum.photo.albumUrl,
        commercialStatus: "AVAILABLE",
        canShowPurchaseCta: true,
        photographerName: firstWithAlbum.photo.photographerName,
        photoCount: null,
        trackedAlbumHref: buildTrackedHref({
          to: firstWithAlbum.photo.albumUrl,
          kind: "ALBUM_CLICK",
          articleId: article.id,
          eventId: ctx.eventId,
        }),
        trackedPurchaseHref: buildTrackedHref({
          to: firstWithAlbum.photo.albumUrl,
          kind: "PURCHASE_CLICK",
          articleId: article.id,
          eventId: ctx.eventId,
        }),
      });
    }
  }

  // Related articles
  const relatedArticles: PublicRelatedArticle[] = [];
  if (coverageLink) {
    const siblings = await prisma.infoSpotCoverageArticle.findMany({
      where: {
        coverageId: coverageLink.id,
        articleId: { not: article.id },
        article: { status: "PUBLISHED" },
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            publishedAt: true,
            coverImage: { select: { url: true } },
          },
        },
      },
      take: 6,
    });
    for (const s of siblings) {
      relatedArticles.push({
        id: s.article.id,
        title: s.article.title,
        slug: s.article.slug,
        excerpt: s.article.excerpt,
        coverImageUrl: s.article.coverImage?.url ?? null,
        publishedAt: s.article.publishedAt,
      });
    }
  }

  if (relatedArticles.length < 4 && article.eventId) {
    const more = await prisma.infoSpotArticle.findMany({
      where: {
        status: "PUBLISHED",
        eventId: article.eventId,
        id: { not: article.id },
        NOT: { id: { in: relatedArticles.map((r) => r.id) } },
      },
      orderBy: { publishedAt: "desc" },
      take: 4 - relatedArticles.length,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        coverImage: { select: { url: true } },
      },
    });
    for (const a of more) {
      relatedArticles.push({
        id: a.id,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        coverImageUrl: a.coverImage?.url ?? null,
        publishedAt: a.publishedAt,
      });
    }
  }

  if (relatedArticles.length < 4 && article.categoryId) {
    const more = await prisma.infoSpotArticle.findMany({
      where: {
        status: "PUBLISHED",
        categoryId: article.categoryId,
        id: { not: article.id },
        NOT: { id: { in: relatedArticles.map((r) => r.id) } },
      },
      orderBy: { publishedAt: "desc" },
      take: 4 - relatedArticles.length,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        coverImage: { select: { url: true } },
      },
    });
    for (const a of more) {
      relatedArticles.push({
        id: a.id,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        coverImageUrl: a.coverImage?.url ?? null,
        publishedAt: a.publishedAt,
      });
    }
  }

  // Related events
  const relatedEvents: PublicRelatedEvent[] = [];
  if (infoSpotEvent) {
    const peers = await prisma.infoSpotEvent.findMany({
      where: {
        ...publicPublishedEventWhere(),
        id: { not: infoSpotEvent.id },
        OR: [
          { categoryId: infoSpotEvent.categoryId ?? undefined },
          { city: infoSpotEvent.city },
        ],
        startAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { startAt: "asc" },
      take: 4,
      select: {
        id: true,
        title: true,
        slug: true,
        city: true,
        province: true,
        startAt: true,
        endAt: true,
        coverImageUrl: true,
      },
    });
    for (const e of peers) {
      relatedEvents.push({
        id: e.id,
        title: e.title,
        slug: e.slug,
        city: e.city,
        province: e.province,
        startAt: e.startAt,
        coverImageUrl: e.coverImageUrl,
        temporalLabel: temporalStateLabel(
          getEventTemporalState({ startAt: e.startAt, endAt: e.endAt }),
        ),
      });
    }
  }

  const commercialStatus =
    albums[0]?.commercialStatus ||
    coverageLink?.commercialStatus ||
    (photos.some((p) => p.canShowPurchaseCta) ? "AVAILABLE" : "UNKNOWN");

  const ogImageUrl =
    coverPhoto?.src ||
    article.coverImage?.url ||
    galleryPhotos.find((p) => p.src)?.src ||
    null;

  // Re-map photos with eventId in tracking context
  const remap = (list: PublicEditorialPhotoViewModel[]) =>
    list.map((p) => {
      const usage = article.editorialPhotoUsages.find((u) => u.photoId === p.id);
      if (!usage) return p;
      return toPublicEditorialPhoto(
        {
          usageType: usage.usageType,
          sortOrder: usage.sortOrder,
          caption: usage.caption,
          altText: usage.altText,
          displaySize: usage.displaySize,
          photo: usage.photo,
        },
        ctx,
      );
    });

  const coverRemapped = coverPhoto
    ? remap([coverPhoto])[0] ?? coverPhoto
    : null;
  const inlineRemapped = remap(inlinePhotos);
  const galleryRemapped = remap(galleryPhotos);
  const featuredRemapped = remap(featuredPhotos);
  const photoByIdRemapped: Record<string, PublicEditorialPhotoViewModel> = {};
  for (const p of [
    ...(coverRemapped ? [coverRemapped] : []),
    ...inlineRemapped,
    ...galleryRemapped,
    ...featuredRemapped,
  ]) {
    photoByIdRemapped[p.id] = p;
  }

  return {
    articleId: article.id,
    articleSlug: article.slug,
    event: eventVm,
    coverage: coverageLink
      ? {
          id: coverageLink.id,
          title: coverageLink.title,
          clfAlbumId: coverageLink.clfAlbumId,
          commercialStatus: coverageLink.commercialStatus,
          canShowPurchaseCta: coverageLink.canShowPurchaseCta,
        }
      : null,
    coverPhoto: coverRemapped,
    inlinePhotos: inlineRemapped,
    galleryPhotos: galleryRemapped,
    featuredPhotos: featuredRemapped,
    photoById: photoByIdRemapped,
    photographers,
    albums,
    commercialAvailability: {
      status: commercialStatus,
      canShowPurchaseCta: albums.some((a) => a.canShowPurchaseCta),
      albumUrl: albums[0]?.publicUrl ?? null,
    },
    relatedArticles,
    relatedEvents,
    ogImageUrl,
  };
}

function rehydratePublicCoverageDates(
  coverage: PublicEditorialCoverage | null,
): PublicEditorialCoverage | null {
  if (!coverage) return null;
  // unstable_cache JSON round-trip turns Date into string
  if (coverage.event?.startAt) {
    coverage.event.startAt = new Date(coverage.event.startAt);
  }
  for (const a of coverage.relatedArticles) {
    if (a.publishedAt) a.publishedAt = new Date(a.publishedAt);
  }
  for (const e of coverage.relatedEvents) {
    e.startAt = new Date(e.startAt);
  }
  return coverage;
}

export async function getPublicEditorialCoverageByArticleSlug(
  slug: string,
  options?: { bypassCache?: boolean },
): Promise<PublicEditorialCoverage | null> {
  if (options?.bypassCache) {
    return rehydratePublicCoverageDates(await resolveUncached(slug));
  }
  const cached = unstable_cache(
    async () => resolveUncached(slug),
    [`public-coverage-article-${slug}`],
    { revalidate: 120, tags: ["infospot-public-coverage", `article-${slug}`] },
  );
  return rehydratePublicCoverageDates(await cached());
}

export async function getPublicEventCoverageBundle(eventSlug: string): Promise<{
  relatedArticles: PublicRelatedArticle[];
  albums: PublicCoverageAlbum[];
  photographers: PublicEditorialCoverage["photographers"];
  seekingPhotographers: boolean;
  joinHref: string | null;
  temporalLabel: string;
} | null> {
  const event = await prisma.infoSpotEvent.findFirst({
    where: { slug: eventSlug, ...publicPublishedEventWhere() },
    include: {
      contentOrigins: {
        where: { sourceType: "COMPRAMELAFOTO", externalEntityType: "EVENT" },
        take: 1,
      },
      photographerCall: true,
    },
  });
  if (!event) return null;

  const temporal = getEventTemporalState({
    startAt: event.startAt,
    endAt: event.endAt,
  });
  const call = resolvePhotographerCallFromSources({
    registrationUrl: event.registrationUrl,
    photographerCall: event.photographerCall,
    origin: event.contentOrigins[0]
      ? {
          externalUrl: event.contentOrigins[0].externalUrl,
          externalId: event.contentOrigins[0].externalId,
          operationalPayload: event.contentOrigins[0].operationalPayload,
        }
      : null,
  });

  const clfEventId = event.contentOrigins[0]?.externalId
    ? Number(event.contentOrigins[0].externalId)
    : null;

  const coverages =
    clfEventId && Number.isFinite(clfEventId)
      ? await prisma.infoSpotCoverage.findMany({
          where: { clfEventId },
          include: { photographers: true, articles: { include: { article: true } } },
          take: 10,
        })
      : [];

  const relatedArticles: PublicRelatedArticle[] = [];
  const albums: PublicCoverageAlbum[] = [];
  const photographersMap = new Map<
    number,
    PublicEditorialCoverage["photographers"][number]
  >();

  for (const cov of coverages) {
    if (cov.commercialStatus === "AVAILABLE" && cov.publicUrl && cov.canShowPurchaseCta) {
      albums.push({
        clfAlbumId: cov.clfAlbumId,
        title: cov.title,
        publicUrl: cov.publicUrl,
        commercialStatus: cov.commercialStatus,
        canShowPurchaseCta: true,
        photographerName: cov.photographers[0]?.displayName ?? null,
        photoCount: cov.photoCount,
        trackedAlbumHref: buildTrackedHref({
          to: cov.publicUrl,
          kind: "ALBUM_CLICK",
          eventId: event.id,
        }),
        trackedPurchaseHref: buildTrackedHref({
          to: cov.publicUrl,
          kind: "PURCHASE_CLICK",
          eventId: event.id,
        }),
      });
    }
    for (const p of cov.photographers) {
      photographersMap.set(p.clfUserId, {
        clfUserId: p.clfUserId,
        displayName: p.displayName,
        role: p.role,
        photoCount: p.photoCount,
        albumHref: cov.publicUrl
          ? buildTrackedHref({
              to: cov.publicUrl,
              kind: "ALBUM_CLICK",
              eventId: event.id,
            })
          : null,
        profileHref: null,
      });
    }
    for (const link of cov.articles) {
      if (link.article.status === "PUBLISHED") {
        relatedArticles.push({
          id: link.article.id,
          title: link.article.title,
          slug: link.article.slug,
          excerpt: link.article.excerpt,
          coverImageUrl: null,
          publishedAt: link.article.publishedAt,
        });
      }
    }
  }

  // Also articles with soft eventId
  if (clfEventId && Number.isFinite(clfEventId)) {
    const arts = await prisma.infoSpotArticle.findMany({
      where: {
        status: "PUBLISHED",
        eventId: clfEventId,
        NOT: { id: { in: relatedArticles.map((a) => a.id) } },
      },
      take: 6,
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        coverImage: { select: { url: true } },
      },
    });
    for (const a of arts) {
      relatedArticles.push({
        id: a.id,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        coverImageUrl: a.coverImage?.url ?? null,
        publishedAt: a.publishedAt,
      });
    }
  }

  return {
    relatedArticles: relatedArticles.slice(0, 8),
    albums,
    photographers: [...photographersMap.values()],
    seekingPhotographers: call.eligible,
    joinHref:
      call.eligible && call.joinUrl
        ? buildTrackedHref({
            to: call.joinUrl,
            kind: "CLF_REGISTRATION_CLICK",
            eventId: event.id,
          })
        : null,
    temporalLabel: temporalStateLabel(temporal),
  };
}
