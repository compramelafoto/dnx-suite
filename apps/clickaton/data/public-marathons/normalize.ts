import { PublicMarathonPayloadError } from "@/data/public-marathons/errors";
import type {
  AllowedDevice,
  MarathonFormat,
  MarathonStatus,
  PublicMarathon,
  RegistrationStatus,
  ResultsStatus,
  GalleryStatus,
} from "@/types/marathon";

const MARATHON_STATUSES = new Set<MarathonStatus>([
  "draft",
  "announced",
  "registration_open",
  "registration_closed",
  "in_progress",
  "judging",
  "results_published",
  "archived",
  "cancelled",
]);

const REGISTRATION_STATUSES = new Set<RegistrationStatus>([
  "unavailable",
  "coming_soon",
  "open",
  "last_places",
  "full",
  "closed",
  "cancelled",
]);

const FORMATS = new Set<MarathonFormat>(["individual", "team", "mixed"]);

const DEVICES = new Set<AllowedDevice>(["smartphone", "camera", "drone"]);

const RESULTS = new Set<ResultsStatus>([
  "not_available",
  "pending",
  "partial",
  "published",
  "archived",
]);

const GALLERIES = new Set<GalleryStatus>([
  "not_available",
  "coming_soon",
  "published",
  "archived",
]);

function assertIsoDate(value: string, field: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PublicMarathonPayloadError(`${field} is not a valid date`);
  }
  return value;
}

function asArray<T>(value: T[] | undefined | null, field: string): T[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new PublicMarathonPayloadError(`${field} must be an array`);
  }
  return value;
}

/**
 * Normaliza un payload hacia `PublicMarathon`.
 * No inventa ciudades, precios ni contenido editorial faltante.
 * Falla ante estados/fechas inválidos.
 */
export function normalizePublicMarathon(input: PublicMarathon): PublicMarathon {
  if (!input || typeof input !== "object") {
    throw new PublicMarathonPayloadError("payload is missing");
  }

  if (!input.id?.trim()) throw new PublicMarathonPayloadError("id is required");
  if (!input.slug?.trim()) throw new PublicMarathonPayloadError("slug is required");
  if (!input.name?.trim()) throw new PublicMarathonPayloadError("name is required");

  if (!MARATHON_STATUSES.has(input.status)) {
    throw new PublicMarathonPayloadError(`unknown status: ${String(input.status)}`);
  }
  if (!REGISTRATION_STATUSES.has(input.registrationStatus)) {
    throw new PublicMarathonPayloadError(
      `unknown registrationStatus: ${String(input.registrationStatus)}`,
    );
  }
  if (!FORMATS.has(input.format)) {
    throw new PublicMarathonPayloadError(`unknown format: ${String(input.format)}`);
  }
  if (!RESULTS.has(input.resultsStatus)) {
    throw new PublicMarathonPayloadError(
      `unknown resultsStatus: ${String(input.resultsStatus)}`,
    );
  }
  if (!GALLERIES.has(input.galleryStatus)) {
    throw new PublicMarathonPayloadError(
      `unknown galleryStatus: ${String(input.galleryStatus)}`,
    );
  }

  for (const device of input.allowedDevices ?? []) {
    if (!DEVICES.has(device)) {
      throw new PublicMarathonPayloadError(`unknown device: ${String(device)}`);
    }
  }

  return {
    ...input,
    id: input.id.trim(),
    slug: input.slug.trim(),
    name: input.name.trim(),
    editionName: input.editionName?.trim() || input.name.trim(),
    shortDescription: input.shortDescription ?? "",
    fullDescription: input.fullDescription ?? "",
    modality: input.modality ?? "",
    featured: Boolean(input.featured),
    isDemo: Boolean(input.isDemo) || undefined,
    city: input.city ?? "",
    provinceOrRegion: input.provinceOrRegion ?? "",
    country: input.country ?? "",
    timezone: input.timezone || "UTC",
    startAt: assertIsoDate(input.startAt, "startAt"),
    endAt: assertIsoDate(input.endAt, "endAt"),
    registrationOpenAt: input.registrationOpenAt
      ? assertIsoDate(input.registrationOpenAt, "registrationOpenAt")
      : undefined,
    registrationCloseAt: input.registrationCloseAt
      ? assertIsoDate(input.registrationCloseAt, "registrationCloseAt")
      : undefined,
    allowedDevices: asArray(input.allowedDevices, "allowedDevices"),
    galleryPreview: asArray(input.galleryPreview, "galleryPreview"),
    categories: asArray(input.categories, "categories"),
    schedule: asArray(input.schedule, "schedule"),
    prizes: asArray(input.prizes, "prizes"),
    jury: asArray(input.jury, "jury"),
    sponsors: asArray(input.sponsors, "sponsors"),
    faq: asArray(input.faq, "faq"),
    challenges: asArray(input.challenges, "challenges"),
    organizer: input.organizer,
    createdAt: assertIsoDate(input.createdAt, "createdAt"),
    updatedAt: assertIsoDate(input.updatedAt, "updatedAt"),
  };
}
