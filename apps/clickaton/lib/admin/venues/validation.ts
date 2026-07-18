import { isValidSlug, normalizeSlug } from "@/lib/admin/slug";
import { parseDateTimeInput } from "@/lib/admin/datetime-input";
import type { ClickatonVenueFormInput } from "./types";

export type VenueValidationErrors = Partial<Record<keyof ClickatonVenueFormInput, string>> & {
  _form?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseOptionalCapacity(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || String(parsed) !== trimmed) return "invalid";
  if (parsed < 0) return "invalid";
  return parsed;
}

function validateDateOrder(
  start: Date | null,
  end: Date | null,
  startLabel: string,
  endLabel: string,
): string | null {
  if (start && end && end.getTime() < start.getTime()) {
    return `${endLabel} debe ser posterior o igual a ${startLabel}.`;
  }
  return null;
}

export function validateVenueFormInput(
  input: ClickatonVenueFormInput,
): { ok: true; data: VenueValidatedData } | { ok: false; errors: VenueValidationErrors } {
  const errors: VenueValidationErrors = {};
  const name = input.name.trim();
  const slug = normalizeSlug(input.slug || input.name);
  const city = input.city.trim();
  const editionId = input.editionId.trim();

  if (!editionId) errors.editionId = "Seleccioná una edición.";
  if (!name) errors.name = "El nombre es obligatorio.";
  if (!city) errors.city = "La ciudad es obligatoria.";
  if (!slug) {
    errors.slug = "El slug es obligatorio.";
  } else if (!isValidSlug(slug)) {
    errors.slug = "Usá solo minúsculas, números y guiones (a-z, 0-9, -).";
  }

  const startsAt = parseDateTimeInput(input.startsAt);
  const endsAt = parseDateTimeInput(input.endsAt);
  if (input.startsAt.trim() && !startsAt) errors.startsAt = "Inicio inválido.";
  if (input.endsAt.trim() && !endsAt) errors.endsAt = "Fin inválido.";
  const rangeError = validateDateOrder(startsAt, endsAt, "inicio", "fin");
  if (rangeError) errors.endsAt = rangeError;

  const capacity = parseOptionalCapacity(input.capacity);
  if (capacity === "invalid") {
    errors.capacity = "La capacidad debe ser un entero mayor o igual a 0.";
  }

  const contactEmail = input.contactEmail.trim();
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    errors.contactEmail = "Email de contacto inválido.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      editionId,
      name,
      slug,
      city,
      provinceOrState: input.provinceOrState.trim() || null,
      country: input.country.trim() || "AR",
      address: input.address.trim() || null,
      meetingPoint: input.meetingPoint.trim() || null,
      capacity: capacity === "invalid" ? null : capacity,
      contactName: input.contactName.trim() || null,
      contactEmail: contactEmail || null,
      contactPhone: input.contactPhone.trim() || null,
      startsAt,
      endsAt,
      isActive: Boolean(input.isActive),
    },
  };
}

export type VenueValidatedData = {
  editionId: string;
  name: string;
  slug: string;
  city: string;
  provinceOrState: string | null;
  country: string;
  address: string | null;
  meetingPoint: string | null;
  capacity: number | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

export function venueFormInputFromFormData(formData: FormData): ClickatonVenueFormInput {
  return {
    editionId: formData.get("editionId")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    slug: formData.get("slug")?.toString() ?? "",
    city: formData.get("city")?.toString() ?? "",
    provinceOrState: formData.get("provinceOrState")?.toString() ?? "",
    country: formData.get("country")?.toString() ?? "AR",
    address: formData.get("address")?.toString() ?? "",
    meetingPoint: formData.get("meetingPoint")?.toString() ?? "",
    capacity: formData.get("capacity")?.toString() ?? "",
    contactName: formData.get("contactName")?.toString() ?? "",
    contactEmail: formData.get("contactEmail")?.toString() ?? "",
    contactPhone: formData.get("contactPhone")?.toString() ?? "",
    startsAt: formData.get("startsAt")?.toString() ?? "",
    endsAt: formData.get("endsAt")?.toString() ?? "",
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  };
}
