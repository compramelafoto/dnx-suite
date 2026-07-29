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
  const tokens = q
    ? q
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const city = filters.city?.trim().toLowerCase() ?? "";
  return events.filter((e) => {
    if (tokens.length > 0) {
      const hay = `${e.title} ${e.city ?? ""}`.toLowerCase();
      // Todos los tokens deben matchear (más flexible que el string completo).
      if (!tokens.every((t) => hay.includes(t))) return false;
    }
    if (city && !(e.city ?? "").toLowerCase().includes(city)) return false;
    // Con búsqueda activa no filtramos por momento: una previa puede estar
    // tipificada como "Sin fecha" o "Finalizado" según dates incompletas.
    if (!q && filters.status && filters.status !== "all") {
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

/** Convierte fila CLF al card del asistente. */
export function clfEventToAssistantCard(e: {
  id: number;
  title: string;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  city: string | null;
  albumCount?: number;
  latitude?: number | null;
  longitude?: number | null;
}): AssistantEventCard {
  const startsAt =
    e.startsAt instanceof Date
      ? e.startsAt.toISOString()
      : e.startsAt
        ? String(e.startsAt)
        : null;
  const endsAt =
    e.endsAt instanceof Date
      ? e.endsAt.toISOString()
      : e.endsAt
        ? String(e.endsAt)
        : null;
  const lat = typeof e.latitude === "number" && Number.isFinite(e.latitude) ? e.latitude : null;
  const lng =
    typeof e.longitude === "number" && Number.isFinite(e.longitude) ? e.longitude : null;
  return {
    id: e.id,
    title: e.title,
    startsAt,
    endsAt,
    city: e.city,
    statusLabel: eventStatusLabel({ startsAt, endsAt }),
    coverageCount: e.albumCount ?? 0,
    photographerCount: 0,
    photoCount: 0,
    coverThumbnailUrl: null,
    categoryHint: null,
    latitude: lat,
    longitude: lng,
    hasGeoref: lat != null && lng != null,
  };
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
