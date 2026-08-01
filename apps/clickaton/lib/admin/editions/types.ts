import { toDateTimeLocalValue } from "@/lib/admin/datetime-input";

export const CLICKATON_EDITION_STATUSES = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
  "REPROGRAMMED",
  "CANCELLED",
] as const;

export type ClickatonEditionStatus = (typeof CLICKATON_EDITION_STATUSES)[number];

export type ClickatonEditionRecord = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  status: ClickatonEditionStatus;
  isPublished: boolean;
  registrationEnabled: boolean;
  timezone: string | null;
  startAt: Date | null;
  endAt: Date | null;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  defaultCapacity: number | null;
  location: string | null;
  city: string | null;
  provinceOrState: string | null;
  country: string;
  currency: string;
  fotorankContestId: string | null;
  fotoRankSyncEnabled: boolean;
  fotoRankSyncMode: "POST_PAID" | "DISABLED";
  fotoRankValidationStatus:
    | "NOT_CONFIGURED"
    | "PENDING_VALIDATION"
    | "VALID"
    | "INVALID"
    | "DISABLED";
  fotoRankLastValidatedAt: Date | null;
  fotoRankValidationError: string | null;
  coverImageUrl: string | null;
  coverImageVerticalUrl: string | null;
  paymentBeneficiaryConfig: unknown | null;
  createdAt: Date;
  updatedAt: Date;
  venueCount?: number;
};

export type ClickatonEditionFormInput = {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  status: ClickatonEditionStatus;
  isPublished: boolean;
  registrationEnabled: boolean;
  timezone: string;
  startAt: string;
  endAt: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  defaultCapacity: string;
  location: string;
  city: string;
  provinceOrState: string;
  country: string;
  currency: string;
  fotorankContestId: string;
  coverImageUrl: string;
  coverImageVerticalUrl: string;
};

export const EDITION_STATUS_LABELS: Record<ClickatonEditionStatus, string> = {
  DRAFT: "Borrador",
  REGISTRATION_OPEN: "Inscripción abierta",
  REGISTRATION_CLOSED: "Inscripción cerrada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Finalizada",
  REPROGRAMMED: "Reprogramada",
  CANCELLED: "Cancelada",
};

export const OPERATIVE_EDITION_STATUSES: ClickatonEditionStatus[] = [
  "REGISTRATION_OPEN",
  "IN_PROGRESS",
];

export function emptyEditionFormInput(): ClickatonEditionFormInput {
  return {
    name: "",
    slug: "",
    shortDescription: "",
    description: "",
    status: "DRAFT",
    isPublished: false,
    registrationEnabled: false,
    timezone: "America/Argentina/Buenos_Aires",
    startAt: "",
    endAt: "",
    registrationOpenAt: "",
    registrationCloseAt: "",
    defaultCapacity: "",
    location: "",
    city: "",
    provinceOrState: "",
    country: "AR",
    currency: "ARS",
    fotorankContestId: "",
    coverImageUrl: "",
    coverImageVerticalUrl: "",
  };
}

export function editionToFormInput(edition: ClickatonEditionRecord): ClickatonEditionFormInput {
  return {
    name: edition.name,
    slug: edition.slug,
    shortDescription: edition.shortDescription ?? "",
    description: edition.description ?? "",
    status: edition.status,
    isPublished: edition.isPublished,
    registrationEnabled: edition.registrationEnabled,
    timezone: edition.timezone ?? "America/Argentina/Buenos_Aires",
    startAt: toDateTimeLocalValue(edition.startAt),
    endAt: toDateTimeLocalValue(edition.endAt),
    registrationOpenAt: toDateTimeLocalValue(edition.registrationOpenAt),
    registrationCloseAt: toDateTimeLocalValue(edition.registrationCloseAt),
    defaultCapacity:
      edition.defaultCapacity === null || edition.defaultCapacity === undefined
        ? ""
        : String(edition.defaultCapacity),
    location: edition.location ?? "",
    city: edition.city ?? "",
    provinceOrState: edition.provinceOrState ?? "",
    country: edition.country || "AR",
    currency: edition.currency || "ARS",
    fotorankContestId: edition.fotorankContestId ?? "",
    coverImageUrl: edition.coverImageUrl ?? "",
    coverImageVerticalUrl: edition.coverImageVerticalUrl ?? "",
  };
}
