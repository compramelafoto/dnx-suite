/**
 * Título H1 del detalle de inscripción (Mi cuenta).
 * Nunca retorna vacío, ID, slug ni placeholders técnicos.
 */
export function buildRegistrationDetailHeading(input: {
  firstName?: string | null;
  lastName?: string | null;
  editionName?: string | null;
}): string {
  const first = (input.firstName ?? "").trim();
  const last = (input.lastName ?? "").trim();
  const fullName = [first, last].filter(Boolean).join(" ").trim();
  if (fullName) {
    return `Inscripción de ${fullName}`;
  }
  const edition = (input.editionName ?? "").trim();
  if (edition) {
    return `Inscripción a ${edition}`;
  }
  return "Detalle de la inscripción";
}
