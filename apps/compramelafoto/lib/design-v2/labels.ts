/** Textos de estado de un diseño, para la pantalla. Puro: lo usan servidor y navegador. */
export const DESIGN_STATUS_LABELS: Record<string, string> = {
  PENDING_PHOTOGRAPHER_APPROVAL: "Para revisar",
  NEEDS_ADJUSTMENT: "Cambios pedidos al cliente",
  APPROVED_FOR_EXPORT: "Aprobado — falta generar el archivo",
  EXPORTED: "Aprobado y entregado",
};

export const DESIGN_STATUS_TONES: Record<string, string> = {
  PENDING_PHOTOGRAPHER_APPROVAL: "bg-amber-50 text-amber-800 ring-amber-200",
  NEEDS_ADJUSTMENT: "bg-sky-50 text-sky-800 ring-sky-200",
  APPROVED_FOR_EXPORT: "bg-rose-50 text-rose-800 ring-rose-200",
  EXPORTED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

export function designStatusLabel(status: string): string {
  return DESIGN_STATUS_LABELS[status] ?? status;
}
