/** Una sola fuente para la ruta: la usan el mail y la propia página. */
export function readinessPath(
  editionSlug: string,
  registrationId: string,
  token: string,
): string {
  return `/maratones/${editionSlug}/preparate/${registrationId}?t=${encodeURIComponent(token)}`;
}

/** Cuánto vive el enlace del mail. El evento es el 12/12/2026. */
export const READINESS_TOKEN_TTL_MS = 120 * 24 * 60 * 60 * 1000;

/** El párrafo que va en el mail de confirmación. La tarea 4 completa el resto. */
export const readinessEmailParagraph =
  "Antes de la Clickatón conviene que revises una cosa: que tu teléfono guarde el lugar donde sacás cada foto. Te lleva un minuto y de eso depende el resumen de tu recorrido al final de la jornada.";
