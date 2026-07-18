import { isValidSlug, normalizeSlug } from "@/lib/admin/slug";
import { parseDateTimeInput } from "@/lib/admin/datetime-input";
import {
  CLICKATON_EDITION_STATUSES,
  type ClickatonEditionFormInput,
  type ClickatonEditionStatus,
} from "./types";

export type EditionValidationErrors = Partial<Record<keyof ClickatonEditionFormInput, string>> & {
  _form?: string;
};

const FOTORANK_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function hasUrlCredentials(url: URL): boolean {
  return Boolean(url.username || url.password);
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return !hasUrlCredentials(url);
  } catch {
    return false;
  }
}

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

export function validateEditionFormInput(
  input: ClickatonEditionFormInput,
  options?: { existingSlug?: string | null },
): { ok: true; data: EditionValidatedData } | { ok: false; errors: EditionValidationErrors } {
  const errors: EditionValidationErrors = {};
  const name = input.name.trim();
  const slug = normalizeSlug(input.slug || input.name);
  const status = input.status;

  if (!name) errors.name = "El nombre es obligatorio.";
  if (!slug) {
    errors.slug = "El slug es obligatorio.";
  } else if (!isValidSlug(slug)) {
    errors.slug = "Usá solo minúsculas, números y guiones (a-z, 0-9, -).";
  } else if (options?.existingSlug && slug !== options.existingSlug) {
    // uniqueness checked at mutation time; format ok
  }

  if (!CLICKATON_EDITION_STATUSES.includes(status as ClickatonEditionStatus)) {
    errors.status = "Estado inválido.";
  }

  const startAt = parseDateTimeInput(input.startAt);
  const endAt = parseDateTimeInput(input.endAt);
  const registrationOpenAt = parseDateTimeInput(input.registrationOpenAt);
  const registrationCloseAt = parseDateTimeInput(input.registrationCloseAt);

  if (input.startAt.trim() && !startAt) errors.startAt = "Fecha de inicio inválida.";
  if (input.endAt.trim() && !endAt) errors.endAt = "Fecha de fin inválida.";
  if (input.registrationOpenAt.trim() && !registrationOpenAt) {
    errors.registrationOpenAt = "Apertura de inscripción inválida.";
  }
  if (input.registrationCloseAt.trim() && !registrationCloseAt) {
    errors.registrationCloseAt = "Cierre de inscripción inválida.";
  }

  const editionRangeError = validateDateOrder(startAt, endAt, "inicio", "fin");
  if (editionRangeError) errors.endAt = editionRangeError;

  const registrationRangeError = validateDateOrder(
    registrationOpenAt,
    registrationCloseAt,
    "apertura de inscripción",
    "cierre de inscripción",
  );
  if (registrationRangeError) errors.registrationCloseAt = registrationRangeError;

  if (registrationOpenAt && endAt && registrationOpenAt.getTime() > endAt.getTime()) {
    errors.registrationOpenAt = "La apertura de inscripción no puede ser posterior al fin de la edición.";
  }
  if (registrationCloseAt && endAt && registrationCloseAt.getTime() > endAt.getTime()) {
    errors.registrationCloseAt = "El cierre de inscripción no puede ser posterior al fin de la edición.";
  }
  if (registrationOpenAt && startAt && registrationOpenAt.getTime() > startAt.getTime()) {
    errors.registrationOpenAt =
      "La apertura de inscripción debería ser anterior o igual al inicio de la edición.";
  }

  const capacity = parseOptionalCapacity(input.defaultCapacity);
  if (capacity === "invalid") {
    errors.defaultCapacity = "La capacidad debe ser un entero mayor o igual a 0.";
  }

  const coverImageUrl = input.coverImageUrl.trim();
  if (coverImageUrl && !isValidHttpUrl(coverImageUrl)) {
    errors.coverImageUrl = "La URL de portada debe ser http(s) sin credenciales embebidas.";
  }

  const fotorankContestId = input.fotorankContestId.trim();
  if (fotorankContestId && !FOTORANK_ID_PATTERN.test(fotorankContestId)) {
    errors.fotorankContestId = "Referencia FotoRank inválida (use letras, números, guiones o guion bajo).";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      name,
      slug,
      shortDescription: input.shortDescription.trim() || null,
      description: input.description.trim() || null,
      status,
      isPublished: Boolean(input.isPublished),
      timezone: input.timezone.trim() || null,
      startAt,
      endAt,
      registrationOpenAt,
      registrationCloseAt,
      defaultCapacity: capacity === "invalid" ? null : capacity,
      fotorankContestId: fotorankContestId || null,
      coverImageUrl: coverImageUrl || null,
    },
  };
}

export type EditionValidatedData = {
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  status: ClickatonEditionStatus;
  isPublished: boolean;
  timezone: string | null;
  startAt: Date | null;
  endAt: Date | null;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  defaultCapacity: number | null;
  fotorankContestId: string | null;
  coverImageUrl: string | null;
};

export function editionFormInputFromFormData(formData: FormData): ClickatonEditionFormInput {
  return {
    name: formData.get("name")?.toString() ?? "",
    slug: formData.get("slug")?.toString() ?? "",
    shortDescription: formData.get("shortDescription")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    status: (formData.get("status")?.toString() ?? "DRAFT") as ClickatonEditionStatus,
    isPublished: formData.get("isPublished") === "on" || formData.get("isPublished") === "true",
    timezone: formData.get("timezone")?.toString() ?? "",
    startAt: formData.get("startAt")?.toString() ?? "",
    endAt: formData.get("endAt")?.toString() ?? "",
    registrationOpenAt: formData.get("registrationOpenAt")?.toString() ?? "",
    registrationCloseAt: formData.get("registrationCloseAt")?.toString() ?? "",
    defaultCapacity: formData.get("defaultCapacity")?.toString() ?? "",
    fotorankContestId: formData.get("fotorankContestId")?.toString() ?? "",
    coverImageUrl: formData.get("coverImageUrl")?.toString() ?? "",
  };
}
