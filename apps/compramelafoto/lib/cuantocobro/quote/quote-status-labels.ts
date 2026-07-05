import type { CuantoCobroQuoteStatus } from "@prisma/client";

export const CC_QUOTE_STATUS_LABELS: Record<CuantoCobroQuoteStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  VIEWED: "Visto por el cliente",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
};

export function formatQuoteStatusLabel(status: CuantoCobroQuoteStatus, archivedAt: string | null): string {
  if (archivedAt) return "Archivado";
  return CC_QUOTE_STATUS_LABELS[status] ?? status;
}
