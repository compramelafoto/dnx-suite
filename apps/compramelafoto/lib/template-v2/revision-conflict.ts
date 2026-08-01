/** Mensaje UI ante 409 revision_conflict (P0-04). */
export const TEMPLATE_V2_REVISION_CONFLICT_MESSAGE =
  "Esta plantilla fue modificada en otra pestaña o por otra persona. Recargá la versión más reciente antes de volver a guardar.";

export function isRevisionConflictResponse(status: number, error?: string): boolean {
  return status === 409 && error === "revision_conflict";
}
