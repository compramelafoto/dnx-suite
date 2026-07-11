/**
 * Queries de solo lectura sobre ComprameLaFoto (CLF_READONLY_DATABASE_URL).
 * No escribe. No importa apps/compramelafoto.
 */

import {
  resolveClfAlbumCommercialAvailability,
  type ClfAlbumCommercialStatus,
} from "@repo/db";
import {
  getClfReadonlyClient,
  getClfReadonlyConnectionInfo,
  probeClfReadonlyConnection,
} from "@/lib/clf-readonly-db";

export type EditorialPriority = "PRIORIDAD_ALTA" | "PRIORIDAD_MEDIA" | "DESCARTAR";

export type ClfReadonlyCandidate = {
  eventId: number;
  nombre: string;
  fecha: string;
  ciudad: string | null;
  lugar: string | null;
  provincia: null; // Event CLF no tiene province
  tipo: string;
  visibility: string;
  organizador: string;
  albumCount: number;
  photoCount: number;
  photographers: string[];
  topAlbumId: number | null;
  topAlbumTitle: string | null;
  topAlbumPublicSlug: string | null;
  topAlbumPublicUrl: string | null;
  commercialStatus: ClfAlbumCommercialStatus | "UNKNOWN";
  commercialReason: string | null;
  occurred: boolean;
  daysAgo: number;
  dataQuality: "alta" | "media" | "baja";
  missing: string[];
  available: string[];
  priority: EditorialPriority;
  priorityReasons: string[];
  suggestedCategorySlug: string;
};

export type ClfPhotoCandidate = {
  photoId: number;
  albumId: number;
  albumTitle: string;
  eventId: number | null;
  eventTitle: string | null;
  photographerName: string;
  previewUrl: string | null;
  thumbKey: string | null;
  canUseAsCover: boolean;
  commercialStatus: ClfAlbumCommercialStatus;
  reason: string;
};

const TYPE_TO_CATEGORY: Record<string, string> = {
  SPORTS: "deportes",
  CONCERT: "cultura",
  FESTIVAL: "cultura",
  SCHOOL: "eventos",
  WEDDING: "eventos",
  CORPORATE: "eventos",
  OTHER: "eventos",
};

export function suggestCategorySlug(eventType: string): string {
  return TYPE_TO_CATEGORY[eventType] || "eventos";
}

function classifyPriority(input: {
  photoCount: number;
  city: string | null;
  photographers: string[];
  commercialStatus: ClfAlbumCommercialStatus | "UNKNOWN";
  occurred: boolean;
  daysAgo: number;
  title: string;
  missing: string[];
}): { priority: EditorialPriority; reasons: string[]; dataQuality: "alta" | "media" | "baja" } {
  const reasons: string[] = [];
  let score = 0;

  if (input.photoCount >= 20) {
    score += 3;
    reasons.push("buen volumen de fotos");
  } else if (input.photoCount >= 5) {
    score += 2;
    reasons.push("fotos suficientes");
  } else if (input.photoCount >= 1) {
    score += 1;
    reasons.push("pocas fotos");
  }

  if (input.city?.trim()) {
    score += 2;
    reasons.push("ciudad identificable");
  } else {
    reasons.push("sin ciudad");
  }

  if (input.photographers.length > 0) {
    score += 2;
    reasons.push("fotógrafo acreditable");
  }

  if (input.commercialStatus === "AVAILABLE") {
    score += 2;
    reasons.push("álbum AVAILABLE (venta posible)");
  } else if (input.commercialStatus === "REACTIVATABLE") {
    score += 1;
    reasons.push("álbum REACTIVATABLE");
  }

  if (input.occurred && input.daysAgo <= 120) {
    score += 2;
    reasons.push("evento reciente");
  } else if (input.occurred && input.daysAgo <= 365) {
    score += 1;
    reasons.push("evento del último año");
  }

  if ((input.title || "").trim().length < 4) {
    return { priority: "DESCARTAR", reasons: ["título insuficiente"], dataQuality: "baja" };
  }
  if (input.photoCount === 0) {
    return { priority: "DESCARTAR", reasons: ["sin fotografías"], dataQuality: "baja" };
  }

  const dataQuality =
    input.missing.length === 0 && input.photoCount >= 10
      ? "alta"
      : input.missing.length <= 2
        ? "media"
        : "baja";

  if (score >= 8) return { priority: "PRIORIDAD_ALTA", reasons, dataQuality };
  if (score >= 5) return { priority: "PRIORIDAD_MEDIA", reasons, dataQuality };
  return { priority: "DESCARTAR", reasons, dataQuality };
}

export async function listClfReadonlyCandidates(take = 50): Promise<{
  connection: Awaited<ReturnType<typeof probeClfReadonlyConnection>>;
  candidates: ClfReadonlyCandidate[];
}> {
  const connection = await probeClfReadonlyConnection();
  if (!connection.ok) {
    return { connection, candidates: [] };
  }

  const client = getClfReadonlyClient();
  const now = new Date();

  const events = await client.event.findMany({
    where: {
      archivedAt: null,
      mergedIntoId: null,
      title: { not: "" },
      albums: {
        some: {
          deletedAt: null,
          photos: { some: { isRemoved: false } },
        },
      },
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      city: true,
      locationName: true,
      type: true,
      visibility: true,
      creator: { select: { name: true, email: true } },
      albums: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          publicSlug: true,
          isHidden: true,
          isPublic: true,
          deletedAt: true,
          firstPhotoDate: true,
          createdAt: true,
          expirationExtensionDays: true,
          cleanupStatus: true,
          user: { select: { id: true, name: true, email: true } },
          _count: {
            select: {
              photos: {
                where: {
                  isRemoved: false,
                  // storageDeletedAt puede no existir en DBs viejas; filtramos en memoria si hace falta
                },
              },
            },
          },
        },
      },
    },
    orderBy: { startsAt: "desc" },
    take: Math.max(take * 3, 80),
  });

  const candidates: ClfReadonlyCandidate[] = events
    .map((e) => {
      const albums = e.albums.filter((a) => a._count.photos > 0);
      const photoCount = albums.reduce((n, a) => n + a._count.photos, 0);
      const topAlbum = [...albums].sort((a, b) => b._count.photos - a._count.photos)[0];
      const photographers = [
        ...new Map(
          albums.map((a) => [a.user.email, a.user.name?.trim() || a.user.email]),
        ).values(),
      ];

      let commercialStatus: ClfAlbumCommercialStatus | "UNKNOWN" = "UNKNOWN";
      let commercialReason: string | null = null;
      let topAlbumPublicUrl: string | null = null;

      if (topAlbum) {
        const avail = resolveClfAlbumCommercialAvailability({
          publicSlug: topAlbum.publicSlug,
          isHidden: topAlbum.isHidden,
          isPublic: topAlbum.isPublic,
          deletedAt: topAlbum.deletedAt,
          firstPhotoDate: topAlbum.firstPhotoDate,
          createdAt: topAlbum.createdAt,
          expirationExtensionDays: topAlbum.expirationExtensionDays,
          cleanupStatus: topAlbum.cleanupStatus,
        });
        commercialStatus = avail.status;
        commercialReason = avail.reason;
        topAlbumPublicUrl = avail.publicUrl;
      }

      const occurred = e.startsAt < now;
      const daysAgo = Math.max(
        0,
        Math.floor((now.getTime() - e.startsAt.getTime()) / 86_400_000),
      );

      const missing: string[] = [];
      if (!e.city?.trim()) missing.push("ciudad");
      if (!e.locationName?.trim()) missing.push("lugar");
      if (photographers.length === 0) missing.push("fotógrafo");
      if (!topAlbum) missing.push("álbum");

      const available: string[] = ["título", "fecha"];
      if (e.city) available.push("ciudad");
      if (e.locationName) available.push("lugar");
      if (albums.length) available.push(`${albums.length} álbum(es)`);
      if (photoCount) available.push(`${photoCount} foto(s)`);
      if (photographers.length) available.push("fotógrafo(s)");

      const { priority, reasons, dataQuality } = classifyPriority({
        photoCount,
        city: e.city,
        photographers,
        commercialStatus,
        occurred,
        daysAgo,
        title: e.title,
        missing,
      });

      return {
        eventId: e.id,
        nombre: e.title,
        fecha: e.startsAt.toISOString(),
        ciudad: e.city || null,
        lugar: e.locationName || null,
        provincia: null,
        tipo: e.type,
        visibility: e.visibility,
        organizador: e.creator.name?.trim() || e.creator.email,
        albumCount: albums.length,
        photoCount,
        photographers,
        topAlbumId: topAlbum?.id ?? null,
        topAlbumTitle: topAlbum?.title ?? null,
        topAlbumPublicSlug: topAlbum?.publicSlug ?? null,
        topAlbumPublicUrl,
        commercialStatus,
        commercialReason,
        occurred,
        daysAgo,
        dataQuality,
        missing,
        available,
        priority,
        priorityReasons: reasons,
        suggestedCategorySlug: suggestCategorySlug(e.type),
      };
    })
    .filter((c) => c.photoCount > 0)
    .sort((a, b) => {
      const order = { PRIORIDAD_ALTA: 0, PRIORIDAD_MEDIA: 1, DESCARTAR: 2 } as const;
      if (order[a.priority] !== order[b.priority]) {
        return order[a.priority] - order[b.priority];
      }
      return b.photoCount - a.photoCount;
    })
    .slice(0, take);

  return { connection, candidates };
}

/** Miniaturas/previews internas para redacción (sin originalKey). */
export async function listClfAlbumPhotoCandidates(
  albumId: number,
  take = 24,
): Promise<ClfPhotoCandidate[]> {
  const info = getClfReadonlyConnectionInfo();
  if (!info.configured) return [];

  const client = getClfReadonlyClient();
  const album = await client.album.findFirst({
    where: { id: albumId, deletedAt: null },
    select: {
      id: true,
      title: true,
      publicSlug: true,
      isHidden: true,
      isPublic: true,
      deletedAt: true,
      firstPhotoDate: true,
      createdAt: true,
      expirationExtensionDays: true,
      cleanupStatus: true,
      eventId: true,
      event: { select: { id: true, title: true } },
      user: { select: { name: true, email: true } },
      photos: {
        where: { isRemoved: false },
        orderBy: { createdAt: "asc" },
        take,
        select: {
          id: true,
          previewUrl: true,
          thumbWatermarkedKey: true,
          previewWatermarkedKey: true,
        },
      },
    },
  });
  if (!album) return [];

  const avail = resolveClfAlbumCommercialAvailability({
    publicSlug: album.publicSlug,
    isHidden: album.isHidden,
    isPublic: album.isPublic,
    deletedAt: album.deletedAt,
    firstPhotoDate: album.firstPhotoDate,
    createdAt: album.createdAt,
    expirationExtensionDays: album.expirationExtensionDays,
    cleanupStatus: album.cleanupStatus,
  });

  const photographerName = album.user.name?.trim() || album.user.email;

  return album.photos.map((p) => {
    const preview =
      p.previewUrl && (p.previewUrl.startsWith("http") || p.previewUrl.startsWith("/"))
        ? p.previewUrl
        : null;
    return {
      photoId: p.id,
      albumId: album.id,
      albumTitle: album.title,
      eventId: album.event?.id ?? album.eventId,
      eventTitle: album.event?.title ?? null,
      photographerName,
      previewUrl: preview,
      thumbKey: p.thumbWatermarkedKey || p.previewWatermarkedKey || null,
      canUseAsCover: Boolean(preview || p.thumbWatermarkedKey) && avail.status !== "UNAVAILABLE",
      commercialStatus: avail.status,
      reason: avail.reason,
    };
  });
}

export async function getClfReadonlyEventForDraft(eventId: number) {
  const client = getClfReadonlyClient();
  return client.event.findFirst({
    where: { id: eventId, archivedAt: null },
    select: {
      id: true,
      title: true,
      startsAt: true,
      city: true,
      locationName: true,
      type: true,
      creator: { select: { name: true, email: true } },
      albums: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          publicSlug: true,
          isHidden: true,
          isPublic: true,
          deletedAt: true,
          firstPhotoDate: true,
          createdAt: true,
          expirationExtensionDays: true,
          cleanupStatus: true,
          user: { select: { name: true, email: true } },
          _count: { select: { photos: { where: { isRemoved: false } } } },
        },
      },
    },
  });
}

export { getClfReadonlyConnectionInfo, probeClfReadonlyConnection };
