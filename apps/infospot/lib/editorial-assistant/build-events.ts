import type { AssistantCoverageCard, AssistantEventCard } from "./types";
import { eventStatusLabel } from "./labels";

type CoverageLike = {
  id: string;
  title: string;
  eventTitle: string | null;
  city: string | null;
  photoCount: number;
  commercialStatus: string;
  coverThumbnailUrl: string | null;
  clfAlbumId: number;
  clfEventId: number | null;
  lastSyncedAt: Date | string | null;
  photographers: { displayName: string }[];
};

/**
 * Agrupa coberturas en cards de evento para la pantalla 2.
 * No expone IDs técnicos en el UI (solo se usan en handlers).
 */
export function buildEventCardsFromCoverages(
  coverages: CoverageLike[],
  now = new Date(),
): AssistantEventCard[] {
  const byEvent = new Map<
    number,
    {
      id: number;
      title: string;
      city: string | null;
      startsAt: string | null;
      endsAt: string | null;
      coverages: CoverageLike[];
      photographers: Set<string>;
      photoCount: number;
      coverThumbnailUrl: string | null;
    }
  >();

  for (const c of coverages) {
    if (c.clfEventId == null) continue;
    const existing = byEvent.get(c.clfEventId);
    const names = c.photographers.map((p) => p.displayName);
    if (!existing) {
      byEvent.set(c.clfEventId, {
        id: c.clfEventId,
        title: c.eventTitle?.trim() || c.title,
        city: c.city,
        startsAt: null,
        endsAt: null,
        coverages: [c],
        photographers: new Set(names),
        photoCount: c.photoCount,
        coverThumbnailUrl: c.coverThumbnailUrl,
      });
    } else {
      existing.coverages.push(c);
      existing.photoCount += c.photoCount;
      for (const n of names) existing.photographers.add(n);
      if (!existing.coverThumbnailUrl && c.coverThumbnailUrl) {
        existing.coverThumbnailUrl = c.coverThumbnailUrl;
      }
      if (!existing.city && c.city) existing.city = c.city;
    }
  }

  return Array.from(byEvent.values())
    .map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      city: e.city,
      statusLabel: eventStatusLabel({
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        now,
      }),
      coverageCount: e.coverages.length,
      photographerCount: e.photographers.size,
      photoCount: e.photoCount,
      coverThumbnailUrl: e.coverThumbnailUrl,
      categoryHint: null,
    }))
    .sort((a, b) => b.photoCount - a.photoCount);
}

export function toCoverageCards(coverages: CoverageLike[]): AssistantCoverageCard[] {
  return coverages.map((c) => ({
    id: c.id,
    title: c.title,
    eventTitle: c.eventTitle,
    city: c.city,
    photoCount: c.photoCount,
    commercialStatus: c.commercialStatus,
    coverThumbnailUrl: c.coverThumbnailUrl,
    clfAlbumId: c.clfAlbumId,
    clfEventId: c.clfEventId,
    photographerNames: c.photographers.map((p) => p.displayName),
    lastSyncedAt: c.lastSyncedAt
      ? typeof c.lastSyncedAt === "string"
        ? c.lastSyncedAt
        : c.lastSyncedAt.toISOString()
      : null,
  }));
}

export function filterEventCards(
  events: AssistantEventCard[],
  filters: {
    q?: string;
    status?: "all" | "upcoming" | "ongoing" | "finished";
    city?: string;
  },
): AssistantEventCard[] {
  const q = filters.q?.trim().toLowerCase() ?? "";
  const city = filters.city?.trim().toLowerCase() ?? "";
  return events.filter((e) => {
    if (q) {
      const hay = `${e.title} ${e.city ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (city && !(e.city ?? "").toLowerCase().includes(city)) return false;
    if (filters.status && filters.status !== "all") {
      const map = {
        upcoming: "Próximo",
        ongoing: "En curso",
        finished: "Finalizado",
      } as const;
      if (e.statusLabel !== map[filters.status]) return false;
    }
    return true;
  });
}

export function materialSummary(coverages: AssistantCoverageCard[]) {
  const photographers = new Set<string>();
  let photos = 0;
  for (const c of coverages) {
    photos += c.photoCount;
    for (const n of c.photographerNames) photographers.add(n);
  }
  return {
    coverageCount: coverages.length,
    photographerCount: photographers.size,
    photoCount: photos,
    photographerNames: Array.from(photographers),
  };
}

export function photoSelectionSummary(
  photos: { role: "COVER" | "GALLERY" | "INLINE" }[],
) {
  return {
    cover: photos.filter((p) => p.role === "COVER").length,
    gallery: photos.filter((p) => p.role === "GALLERY").length,
    inline: photos.filter((p) => p.role === "INLINE").length,
    total: photos.length,
  };
}
