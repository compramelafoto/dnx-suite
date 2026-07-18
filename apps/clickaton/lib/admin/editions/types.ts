import { toDateTimeLocalValue } from "@/lib/admin/datetime-input";

export const CLICKATON_EDITION_STATUSES = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
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
  timezone: string | null;
  startAt: Date | null;
  endAt: Date | null;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  defaultCapacity: number | null;
  fotorankContestId: string | null;
  coverImageUrl: string | null;
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
  timezone: string;
  startAt: string;
  endAt: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  defaultCapacity: string;
  fotorankContestId: string;
  coverImageUrl: string;
};

export const EDITION_STATUS_LABELS: Record<ClickatonEditionStatus, string> = {
  DRAFT: "Borrador",
  REGISTRATION_OPEN: "Inscripción abierta",
  REGISTRATION_CLOSED: "Inscripción cerrada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Finalizada",
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
    timezone: "America/Argentina/Cordoba",
    startAt: "",
    endAt: "",
    registrationOpenAt: "",
    registrationCloseAt: "",
    defaultCapacity: "",
    fotorankContestId: "",
    coverImageUrl: "",
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
    timezone: edition.timezone ?? "America/Argentina/Cordoba",
    startAt: toDateTimeLocalValue(edition.startAt),
    endAt: toDateTimeLocalValue(edition.endAt),
    registrationOpenAt: toDateTimeLocalValue(edition.registrationOpenAt),
    registrationCloseAt: toDateTimeLocalValue(edition.registrationCloseAt),
    defaultCapacity:
      edition.defaultCapacity === null || edition.defaultCapacity === undefined
        ? ""
        : String(edition.defaultCapacity),
    fotorankContestId: edition.fotorankContestId ?? "",
    coverImageUrl: edition.coverImageUrl ?? "",
  };
}
