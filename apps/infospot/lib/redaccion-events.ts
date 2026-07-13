import { prisma } from "@repo/db";
import { hasPendingEventReturn } from "@/lib/editorial/event-adapter";
import {
  filterEventsByVista,
  type RedaccionVista,
} from "@/lib/redaccion-queues";
import {
  buildEventPublishChecklist,
  checklistWarnings,
} from "@/lib/launch-content";

export async function listEventsForRedaccion() {
  return prisma.infoSpotEvent.findMany({
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      contentTag: true,
      originKind: true,
      startAt: true,
      city: true,
      province: true,
      latitude: true,
      longitude: true,
      geocodingStatus: true,
      locationConfirmedAt: true,
      locationVisibility: true,
      authorId: true,
      publishedAt: true,
      returnedAt: true,
      submittedForReviewAt: true,
      summary: true,
      description: true,
      categoryId: true,
      coverImageUrl: true,
      organizerName: true,
      category: { select: { name: true } },
      submission: { select: { id: true, status: true } },
      contentOrigins: {
        where: { sourceType: "COMPRAMELAFOTO", externalEntityType: "EVENT" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          syncStatus: true,
          lastSyncedAt: true,
          externalUrl: true,
          syncError: true,
          operationalPayload: true,
        },
      },
      observations: {
        where: { type: "RETURN" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          message: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });
}

export function filterRedaccionEvents<T extends Parameters<typeof filterEventsByVista>[0][number]>(
  events: T[],
  vista: RedaccionVista,
  userId: number,
) {
  return filterEventsByVista(events, vista, userId, hasPendingEventReturn);
}

export async function getEventEditorialStats() {
  const [draft, inReview, readyLegacy, published, unpublished, archived] =
    await Promise.all([
      prisma.infoSpotEvent.count({ where: { status: "DRAFT" } }),
      prisma.infoSpotEvent.count({ where: { status: "IN_REVIEW" } }),
      prisma.infoSpotEvent.count({ where: { status: "READY_TO_PUBLISH" } }),
      prisma.infoSpotEvent.count({ where: { status: "PUBLISHED" } }),
      prisma.infoSpotEvent.count({ where: { status: "UNPUBLISHED" } }),
      prisma.infoSpotEvent.count({ where: { status: "ARCHIVED" } }),
    ]);
  // ETAPA 15: READY_TO_PUBLISH es alias de IN_REVIEW; se suman para la UI
  return { draft, inReview: inReview + readyLegacy, ready: readyLegacy, published, unpublished, archived };
}

export function summarizeEventChecklist(event: {
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  categoryId?: string | null;
  coverImageUrl?: string | null;
  organizerName?: string | null;
  startAt?: Date | string | null;
  city?: string | null;
  province?: string | null;
  slug?: string | null;
  contentTag?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationConfirmedAt?: Date | string | null;
  geocodingStatus?: string | null;
}) {
  const items = buildEventPublishChecklist({
    title: event.title,
    summary: event.summary,
    description: event.description,
    categoryId: event.categoryId,
    coverImageUrl: event.coverImageUrl,
    organizerName: event.organizerName,
    startAt: event.startAt,
    city: event.city,
    province: event.province,
    slug: event.slug,
    contentTag: event.contentTag as "DEMO" | "REAL" | "NEEDS_REVIEW",
    latitude: event.latitude,
    longitude: event.longitude,
    locationConfirmedAt: event.locationConfirmedAt,
    geocodingStatus: event.geocodingStatus,
  });
  const required = items.filter((i) => i.required);
  return {
    done: required.filter((i) => i.ok).length,
    total: required.length,
    missing: checklistWarnings(items).slice(0, 3),
  };
}
