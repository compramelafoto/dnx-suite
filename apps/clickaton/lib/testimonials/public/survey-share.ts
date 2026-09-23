/**
 * Compartir la encuesta por fuera del correo.
 *
 * No todo el mundo abre el mail, y la comunidad de fotógrafos vive en
 * WhatsApp. El enlace sigue exigiendo sesión y participación: compartirlo en
 * un grupo refuerza el pedido sin abrirle la encuesta a cualquiera.
 */

export function surveyPath(editionSlug: string): string {
  return `/maratones/${editionSlug}/testimonio`;
}

export function surveyUrl(origin: string, editionSlug: string): string {
  return `${origin.replace(/\/$/, "")}${surveyPath(editionSlug)}`;
}

export function buildSurveyShareMessage(input: {
  editionName: string;
  url: string;
}): string {
  return [
    `¡Gracias por haber sido parte de ${input.editionName}!`,
    "Contanos cómo te fue: son dos minutos, y si querés podés dejarle un mensajito al equipo.",
    "",
    // El enlace va último a propósito: WhatsApp previsualiza el último que encuentra.
    input.url,
  ].join("\n");
}

export function buildWhatsappShareUrl(input: {
  editionName: string;
  url: string;
}): string {
  const text = buildSurveyShareMessage(input);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
