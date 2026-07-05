import type { OrganizerFeaturedGallery } from "@prisma/client";
import { EventMemberRole, EventMemberStatus } from "@prisma/client";
import { r2PublicUrl } from "@/lib/organizer-public-landing-data";
import { buildAlbumListCoverUrls } from "@/lib/album/album-list-cover";

export type OrganizerFeaturedGalleryKind = "event" | "album";

export type FeaturedListSortKey =
  | "eventDateDesc"
  | "eventDateAsc"
  | "titleAsc"
  | "titleDesc"
  | "kindAsc"
  | "addedDesc"
  | "manual";

export type OrganizerFeaturedGalleryDto = {
  id: number;
  albumId: number | null;
  eventId: number | null;
  sortOrder: number;
  isActive: boolean;
  kind: OrganizerFeaturedGalleryKind;
  title: string;
  subtitle: string | null;
  city: string | null;
  eventStartsAt: string | null;
  photographerLabel: string | null;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export const FEATURED_LIST_SORT_OPTIONS: Array<{ value: FeaturedListSortKey; label: string }> = [
  { value: "eventDateDesc", label: "Fecha del evento (más reciente)" },
  { value: "eventDateAsc", label: "Fecha del evento (más antiguo)" },
  { value: "titleAsc", label: "Nombre (A → Z)" },
  { value: "titleDesc", label: "Nombre (Z → A)" },
  { value: "kindAsc", label: "Tipo (evento, álbum)" },
  { value: "addedDesc", label: "Agregado recientemente" },
  { value: "manual", label: "Orden manual (página pública)" },
];

/** Include compartido para rutas de destacados del organizador. */
export const organizerFeaturedGalleryInclude = {
  album: {
    select: {
      id: true,
      title: true,
      city: true,
      eventDate: true,
      startsAt: true,
      publicSlug: true,
      coverPhotoId: true,
      coverThumbnailKey: true,
      isPublic: true,
      isHidden: true,
      coverPhoto: { select: { id: true, originalKey: true, previewUrl: true } },
      photos: {
        where: { isRemoved: false },
        select: { id: true, originalKey: true, previewUrl: true, isRemoved: true },
        orderBy: { createdAt: "asc" as const },
        take: 1,
      },
      event: { select: { title: true, creatorId: true, startsAt: true } },
      user: { select: { name: true, email: true } },
    },
  },
  event: {
    select: {
      id: true,
      title: true,
      city: true,
      startsAt: true,
      coverImageKey: true,
      shareSlug: true,
      creatorId: true,
      members: {
        where: { role: EventMemberRole.PHOTOGRAPHER, status: EventMemberStatus.ACTIVE },
        select: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" as const },
        take: 8,
      },
    },
  },
} as const;

function userDisplayName(user: { name: string | null; email: string | null }): string {
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Fotógrafo";
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function filterFeaturedGalleryItems(
  items: OrganizerFeaturedGalleryDto[],
  query: string
): OrganizerFeaturedGalleryDto[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items.filter((item) => {
    const haystack = [
      item.title,
      item.subtitle,
      item.city,
      item.photographerLabel,
      item.kind === "event" ? "evento" : "album álbum",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function sortFeaturedGalleryItems(
  items: OrganizerFeaturedGalleryDto[],
  sort: FeaturedListSortKey
): OrganizerFeaturedGalleryDto[] {
  const copy = [...items];

  switch (sort) {
    case "eventDateDesc":
      return copy.sort((a, b) => compareEventDates(b.eventStartsAt, a.eventStartsAt) || a.id - b.id);
    case "eventDateAsc":
      return copy.sort((a, b) => compareEventDates(a.eventStartsAt, b.eventStartsAt) || a.id - b.id);
    case "titleAsc":
      return copy.sort(
        (a, b) => a.title.localeCompare(b.title, "es") || a.id - b.id
      );
    case "titleDesc":
      return copy.sort(
        (a, b) => b.title.localeCompare(a.title, "es") || a.id - b.id
      );
    case "kindAsc":
      return copy.sort(
        (a, b) =>
          a.kind.localeCompare(b.kind, "es") ||
          compareEventDates(b.eventStartsAt, a.eventStartsAt) ||
          a.id - b.id
      );
    case "addedDesc":
      return copy.sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id - b.id
      );
    case "manual":
    default:
      return copy.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }
}

function compareEventDates(a: string | null, b: string | null): number {
  const ta = a ? Date.parse(a) : Number.NEGATIVE_INFINITY;
  const tb = b ? Date.parse(b) : Number.NEGATIVE_INFINITY;
  return ta - tb;
}

export function mapFeaturedGalleryRow(
  row: OrganizerFeaturedGallery & {
    album?: {
      id: number;
      title: string;
      city: string | null;
      eventDate: Date | null;
      startsAt: Date | null;
      publicSlug: string;
      coverPhotoId: number | null;
      coverThumbnailKey: string | null;
      coverPhoto: { id: number; originalKey: string | null; previewUrl: string | null } | null;
      photos?: { id: number; originalKey: string | null; previewUrl: string | null; isRemoved?: boolean | null }[];
      event?: { title: string; startsAt: Date } | null;
      user?: { name: string | null; email: string | null } | null;
    } | null;
    event?: {
      id: number;
      title: string;
      city: string;
      startsAt: Date;
      coverImageKey: string | null;
      shareSlug: string | null;
      members?: Array<{ user: { name: string | null; email: string | null } }>;
    } | null;
  }
): OrganizerFeaturedGalleryDto {
  if (row.event) {
    const photographers =
      row.event.members?.map((m) => userDisplayName(m.user)).filter(Boolean) ?? [];
    return {
      id: row.id,
      albumId: row.albumId,
      eventId: row.eventId,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      kind: "event",
      title: row.event.title,
      subtitle: row.event.city,
      city: row.event.city,
      eventStartsAt: row.event.startsAt.toISOString(),
      photographerLabel: photographers.length > 0 ? photographers.join(", ") : null,
      coverUrl: r2PublicUrl(row.event.coverImageKey),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  const alb = row.album;
  const eventStartsAt =
    toIsoOrNull(alb?.event?.startsAt) ?? toIsoOrNull(alb?.eventDate) ?? toIsoOrNull(alb?.startsAt);

  return {
    id: row.id,
    albumId: row.albumId,
    eventId: row.eventId,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    kind: "album",
    title: alb?.title ?? "Álbum",
    subtitle: alb?.city || alb?.event?.title || null,
    city: alb?.city ?? null,
    eventStartsAt,
    photographerLabel: alb?.user ? userDisplayName(alb.user) : null,
    coverUrl: alb
      ? buildAlbumListCoverUrls({
          id: alb.id,
          coverPhotoId: alb.coverPhotoId ?? null,
          coverThumbnailKey: alb.coverThumbnailKey,
          coverPhoto: alb.coverPhoto,
          photos: alb.photos,
        }).coverPhotoUrl
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
