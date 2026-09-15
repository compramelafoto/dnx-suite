/**
 * Dónde pedir los bytes de una placa de bienvenida.
 *
 * Siempre por el **proxy autenticado**, que comprueba que quien mira sea el dueño de la
 * inscripción o alguien del equipo. La placa lleva la cara y el nombre de una persona: el
 * proxy de medios públicos rechaza a propósito las claves `clickaton/welcome/…`
 * (`isPublicMediaKey`).
 *
 * Existe porque el archivo guarda una dirección que apunta a ese proxy público, y usarla
 * devuelve 404. Era lo que rompía la vista previa del panel: la placa estaba generada y bien,
 * pero la imagen no cargaba nunca.
 */
export type WelcomeCardMediaFormat = "png" | "webp";

export function welcomeCardMediaUrl(
  registrationId: string,
  options: {
    format?: WelcomeCardMediaFormat;
    disposition?: "inline" | "attachment";
  } = {}
): string {
  const format = options.format ?? "png";
  const disposition = options.disposition ?? "inline";
  return `/api/public/registrations/${encodeURIComponent(registrationId)}/welcome-card?format=${format}&disposition=${disposition}`;
}
