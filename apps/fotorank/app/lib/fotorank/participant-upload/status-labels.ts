import type { PublicUploadFileStatus } from "./types";

export type UploadStatusPresentation = {
  label: string;
  description: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
};

const MAP: Record<PublicUploadFileStatus, UploadStatusPresentation> = {
  idle: { label: "Pendiente", description: "Todavía no seleccionaste una fotografía.", tone: "neutral" },
  validating: { label: "Validando", description: "Estamos revisando el archivo.", tone: "info" },
  selected: { label: "Seleccionada", description: "Archivo válido listo para continuar.", tone: "info" },
  uploading: { label: "Subiendo", description: "Enviando el archivo al servidor.", tone: "info" },
  processing: { label: "Procesando", description: "Verificando requisitos técnicos.", tone: "info" },
  uploaded: { label: "Cargada", description: "Archivo recibido. Todavía no está enviada como obra definitiva.", tone: "success" },
  draft: { label: "Borrador", description: "Hay una obra en borrador.", tone: "warning" },
  ready_to_confirm: { label: "Lista para enviar", description: "Podés confirmar el envío definitivo.", tone: "info" },
  submitted: { label: "Enviada", description: "Envío recibido. Enviar no implica admisión.", tone: "success" },
  needs_correction: { label: "Requiere corrección", description: "Debés reemplazar o corregir la fotografía.", tone: "warning" },
  replaced: { label: "Reemplazada", description: "Se cargó una versión nueva.", tone: "neutral" },
  frozen: { label: "Congelada", description: "La obra no admite más cambios.", tone: "neutral" },
  rejected: { label: "No válida", description: "No cumple requisitos técnicos o de admisión.", tone: "danger" },
  error: { label: "Error de carga", description: "Hubo un problema al subir. Podés reintentar.", tone: "danger" },
};

export function presentUploadFileStatus(status: PublicUploadFileStatus): UploadStatusPresentation {
  return MAP[status];
}

export function mapEntryToUploadFileStatus(input: {
  entryStatus?: string | null;
  technicalSummaryStatus?: string | null;
  manualReviewStatus?: string | null;
  admissionStatus?: string | null;
  uploadPhase?: "idle" | "uploading" | "processing" | "done";
}): PublicUploadFileStatus {
  if (input.uploadPhase === "uploading") return "uploading";
  if (input.uploadPhase === "processing") return "processing";
  if (input.admissionStatus === "FROZEN_FOR_JURY") return "frozen";
  if (input.manualReviewStatus === "REPLACEMENT_REQUESTED") return "needs_correction";
  if (input.entryStatus === "REJECTED" || input.technicalSummaryStatus === "TECHNICALLY_REJECTED") {
    return "rejected";
  }
  if (input.entryStatus === "CONFIRMED") return "submitted";
  if (input.entryStatus === "READY_TO_CONFIRM") return "ready_to_confirm";
  if (input.entryStatus === "REQUIRES_REVIEW") return "ready_to_confirm";
  if (input.entryStatus === "DRAFT") return "draft";
  if (input.entryStatus === "UPLOADED" || input.entryStatus === "PROCESSING") return "uploaded";
  return "idle";
}
