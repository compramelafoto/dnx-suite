/** Mensajes de dashboard participante — sin revelar ranking preliminar. */
export function participantResultsMessage(batchStatus: string | null): string {
  if (
    !batchStatus ||
    batchStatus === "DRAFT" ||
    batchStatus === "GENERATED" ||
    batchStatus === "REVIEW_REQUIRED" ||
    batchStatus === "READY_TO_FINALIZE" ||
    batchStatus === "CANCELLED"
  ) {
    return "Resultados en evaluación";
  }
  if (batchStatus === "FINALIZED") {
    return "Resultados finalizados, publicación pendiente";
  }
  if (batchStatus === "PUBLISHED") {
    return "Resultados publicados";
  }
  return "Resultados en evaluación";
}
