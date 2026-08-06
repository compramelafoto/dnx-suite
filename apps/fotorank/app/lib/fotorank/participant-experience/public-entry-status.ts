/**
 * Copy público de estado de fotografía para el participante.
 * Nunca expone códigos internos (PENDING_MANUAL_REVIEW, reason codes, etc.).
 */

export type PublicEntryStatusCode =
  | "NOT_UPLOADED"
  | "RECEIVED"
  | "IN_REVIEW"
  | "NEEDS_INFO"
  | "CAN_REPLACE"
  | "ADMITTED"
  | "NOT_ADMITTED";

export type PublicEntryStatus = {
  code: PublicEntryStatusCode;
  label: string;
};

export function resolvePublicEntryStatus(input: {
  entryStatus?: string | null;
  admissionStatus?: string | null;
  manualReviewStatus?: string | null;
  evidenceOpen?: boolean;
}): PublicEntryStatus {
  const entry = (input.entryStatus ?? "").toUpperCase();
  const admission = (input.admissionStatus ?? "").toUpperCase();
  const review = (input.manualReviewStatus ?? "").toUpperCase();

  if (!entry) {
    return { code: "NOT_UPLOADED", label: "Pendiente de carga" };
  }
  if (admission === "REJECTED" || entry === "REJECTED") {
    return { code: "NOT_ADMITTED", label: "Fotografía no admitida" };
  }
  if (admission === "ADMITTED" || admission === "FROZEN_FOR_JURY") {
    return { code: "ADMITTED", label: "Fotografía admitida" };
  }
  if (review === "REPLACEMENT_REQUESTED") {
    return { code: "CAN_REPLACE", label: "Podés reemplazar tu fotografía" };
  }
  if (input.evidenceOpen || review === "EVIDENCE_REQUESTED") {
    return { code: "NEEDS_INFO", label: "Necesitamos información adicional" };
  }
  if (entry === "CONFIRMED") {
    return { code: "IN_REVIEW", label: "En revisión" };
  }
  if (
    entry === "READY_TO_CONFIRM" ||
    entry === "REQUIRES_REVIEW" ||
    entry === "UPLOADED" ||
    entry === "PROCESSING"
  ) {
    return { code: "RECEIVED", label: "Fotografía recibida" };
  }
  return { code: "RECEIVED", label: "Fotografía recibida" };
}
