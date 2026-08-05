import type { LogicalAdmissionState } from "./types";
import type { AdmissionOpsMetadata } from "./types";

export type EntryStateSlice = {
  status: string | null | undefined;
  technicalSummaryStatus: string | null | undefined;
  manualReviewStatus: string | null | undefined;
  admissionStatus: string | null | undefined;
  withdrawnAt?: Date | null;
  admissionOps?: AdmissionOpsMetadata | null;
};

/**
 * Mapeo canónico: estados Prisma → estado lógico de producto.
 * No crea enums Prisma nuevos.
 */
export function toLogicalAdmissionState(row: EntryStateSlice): LogicalAdmissionState {
  if (row.withdrawnAt || row.status === "WITHDRAWN" || row.admissionStatus === "WITHDRAWN") {
    return "WITHDRAWN";
  }
  if (row.admissionStatus === "FROZEN_FOR_JURY") return "FROZEN";
  if (row.admissionStatus === "ADMITTED") return "ADMITTED";
  if (
    row.admissionStatus === "REJECTED" ||
    row.status === "REJECTED" ||
    row.technicalSummaryStatus === "TECHNICALLY_REJECTED" ||
    row.manualReviewStatus === "REJECTED"
  ) {
    return "REJECTED";
  }
  if (row.manualReviewStatus === "REPLACEMENT_REQUESTED") return "REPLACEMENT_ALLOWED";
  if (row.admissionOps?.evidenceRequest?.status === "OPEN") return "EVIDENCE_REQUESTED";
  if (
    row.admissionStatus === "PENDING_MANUAL_REVIEW" ||
    row.status === "REQUIRES_REVIEW" ||
    row.technicalSummaryStatus === "REQUIRES_REVIEW" ||
    row.manualReviewStatus === "PENDING"
  ) {
    return "MANUAL_REVIEW_REQUIRED";
  }
  if (
    row.admissionStatus === "ELIGIBLE" ||
    row.technicalSummaryStatus === "APPROVED" ||
    row.technicalSummaryStatus === "APPROVED_WITH_WARNINGS"
  ) {
    return "AUTO_CHECK_PASSED";
  }
  if (row.admissionStatus === "PENDING_AUTOMATIC_REVIEW" || row.status === "PROCESSING") {
    return "AUTO_CHECK_PENDING";
  }
  if (row.status === "UPLOADED" || row.status === "DRAFT") return "UPLOADED";
  return "UPLOADED";
}

export type PublicParticipantAdmissionView = {
  logicalState: LogicalAdmissionState;
  publicLabel: string;
  publicMessage: string;
  replacementAllowed: boolean;
  evidenceRequested: boolean;
  evidenceDeadlineAt: string | null;
  evidencePublicMessage: string | null;
  admitted: boolean;
  rejected: boolean;
  frozen: boolean;
};

export function toPublicParticipantAdmissionView(
  row: EntryStateSlice,
): PublicParticipantAdmissionView {
  const logicalState = toLogicalAdmissionState(row);
  const evidence = row.admissionOps?.evidenceRequest ?? null;
  const labels: Record<LogicalAdmissionState, string> = {
    UPLOADED: "Archivo recibido",
    AUTO_CHECK_PENDING: "Análisis técnico en curso",
    AUTO_CHECK_PASSED: "Análisis técnico OK — pendiente de admisión",
    AUTO_CHECK_FAILED: "Análisis técnico con fallos",
    MANUAL_REVIEW_REQUIRED: "En revisión manual",
    EVIDENCE_REQUESTED: "Evidencia solicitada",
    REPLACEMENT_ALLOWED: "Reemplazo habilitado",
    ADMITTED: "Admitida",
    REJECTED: "No admitida",
    WITHDRAWN: "Retirada",
    FROZEN: "Congelada para jurado",
  };
  const messages: Record<LogicalAdmissionState, string> = {
    UPLOADED: "Recibimos tu archivo. Una carga exitosa no implica admisión.",
    AUTO_CHECK_PENDING: "Estamos analizando metadatos y reglas del concurso.",
    AUTO_CHECK_PASSED:
      "El análisis automático no encontró bloqueos. Un organizador debe admitir formalmente la obra.",
    AUTO_CHECK_FAILED: "Hay observaciones técnicas. Revisá el detalle o reemplazá el archivo si está permitido.",
    MANUAL_REVIEW_REQUIRED: "Tu obra está en cola de revisión operativa.",
    EVIDENCE_REQUESTED: evidence?.publicMessage ?? "Se solicitó evidencia adicional.",
    REPLACEMENT_ALLOWED: "Podés reemplazar el archivo antes del cierre o del plazo indicado.",
    ADMITTED: "Tu obra fue admitida técnicamente. Aún no está en el pool del jurado hasta el freeze.",
    REJECTED: "Tu obra no fue admitida. Consultá el motivo público.",
    WITHDRAWN: "Retiraste esta obra.",
    FROZEN: "La obra quedó congelada para evaluación del jurado.",
  };

  return {
    logicalState,
    publicLabel: labels[logicalState],
    publicMessage: messages[logicalState],
    replacementAllowed: logicalState === "REPLACEMENT_ALLOWED",
    evidenceRequested: logicalState === "EVIDENCE_REQUESTED",
    evidenceDeadlineAt: evidence?.deadlineAt ?? null,
    evidencePublicMessage: evidence?.publicMessage ?? null,
    admitted: logicalState === "ADMITTED" || logicalState === "FROZEN",
    rejected: logicalState === "REJECTED",
    frozen: logicalState === "FROZEN",
  };
}

/** Elegibilidad jurado: solo FROZEN cuando admissionStatus está aplicado. */
export function isJuryEligibleFromAdmission(admissionStatus: string | null | undefined): boolean {
  return admissionStatus === "FROZEN_FOR_JURY";
}
