/**
 * Genera número de inscripción legible único por concurso.
 * Prefijo derivado del slug (máx 6 chars alfanum) + secuencia zero-padded.
 */
export function buildRegistrationNumber(contestSlug: string, sequence: number): string {
  const prefix = contestSlug
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6) || "FR";
  const seq = Math.max(1, Math.floor(sequence));
  return `${prefix}-${String(seq).padStart(6, "0")}`;
}
