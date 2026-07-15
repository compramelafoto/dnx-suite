/**
 * Contratos y reglas de visibilidad para APIs públicas de eventos (/g, /e, Home).
 */

import { EventVisibility } from "@prisma/client";

export const EVENT_TYPE_LABELS: Record<string, string> = {
  PUBLIC_SESSION: "Sesión pública",
  PRIVATE_SESSION: "Sesión privada",
  SPORTS: "Evento deportivo",
  PUBLIC_PHOTOGRAPHY: "Fotografías públicas",
  SCHOOL: "Eventos escolares",
  RELIGIOUS: "Eventos religiosos",
  FESTIVAL: "Festival",
  CONFERENCE: "Conferencia",
  CONCERT: "Recital",
  CORPORATE: "Corporativo",
  WEDDING: "Boda",
  BIRTHDAY: "Cumpleaños",
  GRADUATION: "Graduación",
  OTHER: "Otro",
};

/** Campos del listado Home / discovery. */
export const PUBLIC_EVENT_LIST_FIELDS = [
  "id",
  "title",
  "type",
  "typeLabel",
  "city",
  "locationName",
  "startsAt",
  "shareSlug",
  "distanceKm",
  "isPast",
  "coverUrl",
  "joinUrl",
  "source",
  "photographerName",
] as const;

/** Detalle público por shareSlug (invitación /e). Sin economía ni PII interna. */
export const PUBLIC_EVENT_DETAIL_FIELDS = [
  "id",
  "title",
  "description",
  "type",
  "status",
  "visibility",
  "startsAt",
  "endsAt",
  "locationName",
  "city",
  "accreditationNotes",
  "photographerTerms",
  "uploadsEnabled",
  "maxPhotographers",
  "expectedAttendees",
  "membersCount",
  "coverUrl",
  "joinPolicy",
] as const;

export const PUBLIC_EVENT_FORBIDDEN_FIELDS = [
  "rulesData",
  "creatorId",
  "organizerCommissionEnabled",
  "organizerCommissionPercentage",
  "fixedPhotoPrice",
  "minimumPhotoPrice",
  "photoPricingMode",
  "latitude",
  "longitude",
  "promoCommitment",
  "mergedIntoId",
  "email",
  "phone",
  "mpAccessToken",
] as const;

export type EventVisibilityAccess = {
  visibility: EventVisibility | string;
  archivedAt?: Date | null;
};

/** Listable en GET /api/public/events (solo PUBLIC, no archivado). */
export function canListEventPublicly(event: EventVisibilityAccess): boolean {
  if (event.archivedAt) return false;
  return event.visibility === EventVisibility.PUBLIC;
}

/** Accesible por shareSlug (PUBLIC o UNLISTED; PRIVATE y archivados → no). */
export function canAccessEventByShareSlug(event: EventVisibilityAccess): boolean {
  if (event.archivedAt) return false;
  return (
    event.visibility === EventVisibility.PUBLIC ||
    event.visibility === EventVisibility.UNLISTED
  );
}

export function buildListableEventsWhere(searchQ?: string) {
  const where: {
    shareSlug: { not: null };
    archivedAt: null;
    visibility: typeof EventVisibility.PUBLIC;
    OR?: Array<Record<string, { contains: string; mode: "insensitive" }>>;
  } = {
    shareSlug: { not: null },
    archivedAt: null,
    visibility: EventVisibility.PUBLIC,
  };

  const q = (searchQ ?? "").trim().slice(0, 200);
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { locationName: { contains: q, mode: "insensitive" } },
      { shareSlug: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export type PublicEventDetailInput = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  visibility: EventVisibility | string;
  startsAt: Date;
  endsAt: Date | null;
  locationName: string | null;
  city: string;
  accreditationNotes: string | null;
  photographerTerms: string | null;
  uploadsEnabled: boolean;
  maxPhotographers: number | null;
  expectedAttendees: number | null;
  joinPolicy: string;
  membersCount: number;
  coverUrl: string | null;
};

export function toPublicEventDetail(input: PublicEventDetailInput) {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    type: input.type,
    status: input.status,
    visibility: input.visibility,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    locationName: input.locationName,
    city: input.city,
    accreditationNotes: input.accreditationNotes,
    photographerTerms: input.photographerTerms,
    uploadsEnabled: input.uploadsEnabled,
    maxPhotographers: input.maxPhotographers,
    expectedAttendees: input.expectedAttendees,
    membersCount: input.membersCount,
    coverUrl: input.coverUrl,
    joinPolicy: input.joinPolicy,
  };
}

export function sanitizeEventInterestPayload(body: {
  name?: unknown;
  lastName?: unknown;
  whatsapp?: unknown;
  email?: unknown;
}):
  | {
      ok: true;
      name: string;
      lastName: string | null;
      whatsapp: string | null;
      email: string;
    }
  | { ok: false; error: string; status: number } {
  const name = String(body?.name ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();
  const whatsapp = String(body?.whatsapp ?? "").trim();
  const rawEmail = String(body?.email ?? "").trim().toLowerCase();

  if (!name) {
    return { ok: false, error: "Nombre es requerido", status: 400 };
  }
  if (!rawEmail) {
    return { ok: false, error: "Email es requerido", status: 400 };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return { ok: false, error: "Email inválido", status: 400 };
  }

  return {
    ok: true,
    name,
    lastName: lastName || null,
    whatsapp: whatsapp || null,
    email: rawEmail,
  };
}
