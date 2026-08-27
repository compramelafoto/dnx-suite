import {
  CLICKATON_DEFAULT_TIMEZONE,
  formatDateDayMonthUppercase,
  formatDateShort,
  formatParticipantNumber,
  normalizeInstagramHandle,
} from "@repo/template-engine";
import { CLICKATON_CARD_LOGO_DATA_URL } from "./participant-card-branding-logo";
import type { ParticipantCardRegistrationSnapshot } from "./participant-card-types";

/**
 * El render corre sobre `about:blank` (Playwright `setContent`) o en el worker
 * remoto, así que una ruta `/brand/...` no resuelve contra ningún origen.
 * Siempre se embebe el logo como data URL.
 */
function resolveBrandingLogoUrl(): string {
  return CLICKATON_CARD_LOGO_DATA_URL;
}

function formatEditionDate(
  startAt: Date | null,
  timezone: string | null
): { iso: string; formatted: string } {
  if (!startAt) {
    return { iso: "", formatted: "" };
  }
  const iso = startAt.toISOString().slice(0, 10);
  const tz = timezone?.trim() || CLICKATON_DEFAULT_TIMEZONE;
  return {
    iso,
    formatted: formatDateDayMonthUppercase(iso, tz),
  };
}

function buildParticipantNumber(
  registration: ParticipantCardRegistrationSnapshot
): { number: number | null; formatted: string } {
  if (registration.sequenceNumber != null) {
    return {
      number: registration.sequenceNumber,
      formatted: formatParticipantNumber(registration.sequenceNumber, 4),
    };
  }
  const digits = (registration.visibleCode ?? "").replace(/\D/g, "");
  if (digits) {
    const n = Number.parseInt(digits, 10);
    if (Number.isFinite(n)) {
      return { number: n, formatted: formatParticipantNumber(n, 4) };
    }
  }
  return { number: null, formatted: "" };
}

export type BuildClickatonParticipantTemplateDataInput = {
  registration: ParticipantCardRegistrationSnapshot;
  photoDataUrl: string;
};

/**
 * Mapea una inscripción Clickatón al shape esperado por el plugin de variables.
 */
export function buildClickatonParticipantTemplateData(
  input: BuildClickatonParticipantTemplateDataInput
): Record<string, unknown> {
  const { registration, photoDataUrl } = input;
  const fullName = [registration.firstName, registration.lastName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
  const displayName = fullName.toUpperCase();

  const igRaw =
    registration.instagramHandle ??
    registration.instagramHandleNormalized ??
    "";
  const ig = igRaw ? normalizeInstagramHandle(igRaw) : { ok: false as const };

  const { number, formatted: numberFormatted } = buildParticipantNumber(registration);
  const eventDate = formatEditionDate(
    registration.edition.startAt,
    registration.edition.timezone
  );
  const city =
    registration.city?.trim() ||
    registration.venue?.city?.trim() ||
    registration.edition.city?.trim() ||
    "";
  const venueName =
    registration.venue?.name?.trim() ||
    registration.edition.location?.trim() ||
    "";

  const nested: Record<string, unknown> = {
    participant: {
      id: registration.id,
      fullName,
      firstName: registration.firstName.trim(),
      lastName: registration.lastName.trim(),
      displayName,
      instagram: ig.ok ? ig.handle : "",
      instagramHandle: ig.ok ? ig.displayHandle : "",
      city,
      province: registration.province?.trim() ?? "",
      country: registration.country,
      category: registration.ticketType.name,
      number,
      numberFormatted,
      photo: photoDataUrl,
      photoUrl: photoDataUrl,
    },
    edition: {
      id: registration.edition.slug,
      name: registration.edition.name,
      shortName: registration.edition.city ?? registration.edition.name,
      city: registration.edition.city ?? city,
      venue: venueName,
      eventDate: eventDate.iso,
      eventDateFormatted: eventDate.formatted,
      registrationDate: registration.termsAcceptedAt
        ? formatDateShort(registration.termsAcceptedAt.toISOString().slice(0, 10))
        : "",
      slug: registration.edition.slug,
      coverImageUrl: registration.edition.coverImageUrl ?? "",
    },
    event: {
      name: registration.edition.name,
      date: eventDate.iso,
      dateFormatted: eventDate.formatted,
      city: registration.edition.city ?? city,
      venue: venueName,
    },
    branding: {
      name: "Clickatón",
      logo: resolveBrandingLogoUrl(),
      logoUrl: resolveBrandingLogoUrl(),
      primaryColor: "#FFE600",
      secondaryColor: "#000000",
      accentColor: "#3B1F6E",
    },
    card: {
      message:
        "Una comunidad que recorre, crea y muestra la ciudad desde nuevas miradas.",
    },
  };

  const flat: Record<string, unknown> = {};
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        walk(v as Record<string, unknown>, path);
      } else {
        flat[path] = v;
      }
    }
  };
  walk(nested, "");

  return { ...nested, ...flat };
}

export function sanitizeParticipantCardFilenamePart(
  registration: ParticipantCardRegistrationSnapshot
): string {
  if (registration.sequenceNumber != null) {
    return String(registration.sequenceNumber).padStart(4, "0");
  }
  const digits = (registration.visibleCode ?? "").replace(/\D/g, "");
  if (digits) return digits.slice(0, 8);
  const code = (registration.visibleCode ?? registration.id.slice(0, 8))
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 8);
  return code || "xxxx";
}

export function buildParticipantCardFilename(
  cardType: "welcome" | "member",
  registration: ParticipantCardRegistrationSnapshot
): string {
  const part = sanitizeParticipantCardFilenamePart(registration);
  const prefix =
    cardType === "welcome" ? "clickaton-bienvenida" : "clickaton-soy-parte";
  return `${prefix}-${part}.png`;
}
