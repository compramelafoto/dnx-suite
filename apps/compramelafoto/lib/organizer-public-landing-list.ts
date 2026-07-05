import type { FeaturedListSortKey } from "@/lib/organizer-landing-featured";
import type {
  OrganizerPublicFeaturedGallery,
  OrganizerPublicLandingEvent,
} from "@/lib/organizer-public-landing-data";

export type { FeaturedListSortKey };

export const PUBLIC_FEATURED_SORT_OPTIONS: Array<{ value: FeaturedListSortKey; label: string }> = [
  { value: "manual", label: "Orden del organizador" },
  { value: "eventDateDesc", label: "Fecha del evento (más reciente)" },
  { value: "eventDateAsc", label: "Fecha del evento (más antiguo)" },
  { value: "titleAsc", label: "Nombre (A → Z)" },
  { value: "titleDesc", label: "Nombre (Z → A)" },
  { value: "kindAsc", label: "Tipo (evento, álbum)" },
];

export const PUBLIC_UPCOMING_EVENT_SORT_OPTIONS: Array<{ value: FeaturedListSortKey; label: string }> = [
  { value: "eventDateAsc", label: "Fecha (próximo primero)" },
  { value: "eventDateDesc", label: "Fecha (más lejano primero)" },
  { value: "titleAsc", label: "Nombre (A → Z)" },
  { value: "titleDesc", label: "Nombre (Z → A)" },
];

export const PUBLIC_PAST_EVENT_SORT_OPTIONS: Array<{ value: FeaturedListSortKey; label: string }> = [
  { value: "eventDateDesc", label: "Fecha (más reciente)" },
  { value: "eventDateAsc", label: "Fecha (más antiguo)" },
  { value: "titleAsc", label: "Nombre (A → Z)" },
  { value: "titleDesc", label: "Nombre (Z → A)" },
];

function compareEventDates(a: string | null | undefined, b: string | null | undefined): number {
  const ta = a ? Date.parse(a) : Number.NEGATIVE_INFINITY;
  const tb = b ? Date.parse(b) : Number.NEGATIVE_INFINITY;
  return ta - tb;
}

export function filterPublicFeaturedGalleries(
  items: OrganizerPublicFeaturedGallery[],
  query: string
): OrganizerPublicFeaturedGallery[] {
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

export function sortPublicFeaturedGalleries(
  items: OrganizerPublicFeaturedGallery[],
  sort: FeaturedListSortKey
): OrganizerPublicFeaturedGallery[] {
  const copy = [...items];

  switch (sort) {
    case "eventDateDesc":
      return copy.sort(
        (a, b) => compareEventDates(b.startsAt, a.startsAt) || a.sortOrder - b.sortOrder || a.id - b.id
      );
    case "eventDateAsc":
      return copy.sort(
        (a, b) => compareEventDates(a.startsAt, b.startsAt) || a.sortOrder - b.sortOrder || a.id - b.id
      );
    case "titleAsc":
      return copy.sort(
        (a, b) => a.title.localeCompare(b.title, "es") || a.sortOrder - b.sortOrder || a.id - b.id
      );
    case "titleDesc":
      return copy.sort(
        (a, b) => b.title.localeCompare(a.title, "es") || a.sortOrder - b.sortOrder || a.id - b.id
      );
    case "kindAsc":
      return copy.sort(
        (a, b) =>
          a.kind.localeCompare(b.kind, "es") ||
          compareEventDates(b.startsAt, a.startsAt) ||
          a.sortOrder - b.sortOrder ||
          a.id - b.id
      );
    case "addedDesc":
    case "manual":
    default:
      return copy.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }
}

/** Orden inicial en servidor: respeta el orden manual del panel del organizador. */
export function sortFeaturedGalleriesForPublicPage(
  items: OrganizerPublicFeaturedGallery[]
): OrganizerPublicFeaturedGallery[] {
  return sortPublicFeaturedGalleries(items, "manual");
}

export function filterPublicLandingEvents(
  events: OrganizerPublicLandingEvent[],
  query: string
): OrganizerPublicLandingEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return events;

  return events.filter((ev) => {
    const haystack = [ev.title, ev.city, ev.locationName, ev.photographerLabel]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function sortPublicLandingEvents(
  events: OrganizerPublicLandingEvent[],
  sort: FeaturedListSortKey
): OrganizerPublicLandingEvent[] {
  const copy = [...events];

  switch (sort) {
    case "eventDateAsc":
      return copy.sort(
        (a, b) => compareEventDates(a.startsAt, b.startsAt) || a.id - b.id
      );
    case "titleAsc":
      return copy.sort((a, b) => a.title.localeCompare(b.title, "es") || a.id - b.id);
    case "titleDesc":
      return copy.sort((a, b) => b.title.localeCompare(a.title, "es") || a.id - b.id);
    case "eventDateDesc":
    default:
      return copy.sort(
        (a, b) => compareEventDates(b.startsAt, a.startsAt) || a.id - b.id
      );
  }
}

export function sortUpcomingEventsForPublicPage(
  events: OrganizerPublicLandingEvent[]
): OrganizerPublicLandingEvent[] {
  return sortPublicLandingEvents(events, "eventDateAsc");
}

export function sortPastEventsForPublicPage(
  events: OrganizerPublicLandingEvent[]
): OrganizerPublicLandingEvent[] {
  return sortPublicLandingEvents(events, "eventDateDesc");
}
