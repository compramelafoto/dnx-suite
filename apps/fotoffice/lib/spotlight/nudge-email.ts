import type { RenderedEmailSignature } from "@repo/communications/signature";
import { compose, type EmailBody } from "@/lib/membership/application-emails";

/**
 * El aviso al Socio de la semana para que complete su perfil. Módulo puro.
 *
 * Sale cuando le toca salir y su tarjeta muestra poco: sin foto, sin «Más sobre mí», sin contar a
 * qué se dedica o sin portfolio. Explica para qué sirve —conocerse entre colegas— y enumera sólo
 * lo que le falta, para que sepa exactamente qué hacer.
 */

export type ProfileFacts = {
  hasAccount: boolean;
  hasPhoto: boolean;
  aboutAnswers: number;
  featuredPhotos: number;
  hasProfessionalProfile: boolean;
  portfolioPhotos: number;
  /** Si la institución tiene el módulo de portfolios: sin módulo no se le pide armarlo. */
  portfolioEnabled: boolean;
  hasPhone: boolean;
  hasCity: boolean;
};

export type MissingItem =
  | "ACCOUNT"
  | "PHOTO"
  | "ABOUT"
  | "FEATURED_PHOTOS"
  | "PROFESSIONAL"
  | "PORTFOLIO"
  | "PERSONAL";

const TEXTO: Record<MissingItem, string> = {
  ACCOUNT: "Activar tu cuenta del portal de socios (con el botón de abajo). Sin ella no podés cargar nada.",
  PHOTO: "Subir tu foto de perfil, que es la que va en tu tarjeta y en tu placa.",
  ABOUT:
    "Completar «Más sobre mí»: ocho preguntas cortas —cómo empezaste, qué te apasiona fotografiar, en qué podés dar una mano— para que tus colegas te conozcan.",
  FEATURED_PHOTOS: "Elegir hasta 3 fotos tuyas para la placa que se comparte en redes (en «Más sobre mí»).",
  PROFESSIONAL: "Contar a qué te dedicás: tus especialidades, una presentación breve y tu Instagram o tu web.",
  PORTFOLIO: "Armar tu portfolio con tus mejores fotos: tu tarjeta va a llevar directo a él.",
  PERSONAL: "Revisar tus datos personales (teléfono y ciudad), para que tus colegas sepan de dónde sos y puedan escribirte.",
};

/** Cómo se nombra cada faltante en el panel de Comunicación (en tercera persona). */
export const MISSING_ITEM_LABEL: Record<MissingItem, string> = {
  ACCOUNT: "Activar su cuenta del portal (todavía no aceptó la invitación).",
  PHOTO: "Foto de perfil.",
  ABOUT: "«Más sobre mí».",
  FEATURED_PHOTOS: "Las fotos para su placa.",
  PROFESSIONAL: "Especialidades, presentación, Instagram o web.",
  PORTFOLIO: "Portfolio.",
  PERSONAL: "Teléfono o ciudad.",
};

/** Lo que le falta, en el orden en que conviene hacerlo. Vacío = la tarjeta ya está completa. */
export function missingProfileItems(f: ProfileFacts): MissingItem[] {
  const faltan: MissingItem[] = [];
  if (!f.hasAccount) faltan.push("ACCOUNT");
  if (!f.hasPhoto) faltan.push("PHOTO");
  if (f.aboutAnswers === 0) faltan.push("ABOUT");
  if (f.featuredPhotos === 0) faltan.push("FEATURED_PHOTOS");
  if (!f.hasProfessionalProfile) faltan.push("PROFESSIONAL");
  if (f.portfolioEnabled && f.portfolioPhotos === 0) faltan.push("PORTFOLIO");
  if (!f.hasPhone || !f.hasCity) faltan.push("PERSONAL");
  return faltan;
}

/**
 * Le alcanza con lo que tiene para no molestarlo: foto, algo de «Más sobre mí» y su perfil
 * profesional. Las fotos de la placa, el portfolio y los datos personales suman, pero por sí solos
 * no justifican un correo.
 */
export function needsNudge(f: ProfileFacts): boolean {
  return !f.hasAccount || !f.hasPhoto || f.aboutAnswers === 0 || !f.hasProfessionalProfile;
}

export function buildSpotlightNudgeEmail(input: {
  firstName: string;
  institution: string;
  /** "del viernes 2 al jueves 8 de octubre". */
  weekLabel: string;
  missing: MissingItem[];
  hasAccount: boolean;
  /** Con cuenta: «Más sobre mí». Sin cuenta: el enlace para activarla. */
  ctaUrl: string;
  signature: RenderedEmailSignature | null;
}): EmailBody {
  const lista = input.missing.map((m) => `• ${TEXTO[m]}`);
  return compose({
    subject: `¡Sos el Socio de la semana de ${input.institution}! Completá tu perfil`,
    greetingName: input.firstName,
    paragraphs: [
      `Esta semana (${input.weekLabel}) sos el Socio de la semana de ${input.institution}. Todos los socios ven tu tarjeta en su panel, y el área de comunicación prepara una placa con tu foto para compartir en redes.`,
      "¿Para qué sirve? Para que nos conozcamos entre colegas: quién sos, qué te apasiona, en qué podés dar una mano y en qué te gustaría crecer. Conocerse es el primer paso para armar una red fuerte: alguien a quien recomendar cuando no podés tomar un trabajo, con quien asociarte en un evento grande o a quien pedirle un consejo. Muchas alianzas y trabajos nacen de una charla entre colegas.",
      "Hoy tu tarjeta muestra muy poco de vos. Para que se vea completa te falta:",
      ...lista,
      "Lleva unos minutos y todo es opcional: se muestra sólo lo que completes. Cuanto más cuentes, mejor te van a conocer.",
    ],
    cta: input.hasAccount
      ? { label: "Completar mi perfil", url: input.ctaUrl }
      : { label: "Activar mi cuenta", url: input.ctaUrl },
    notes: input.hasAccount
      ? ["En el portal vas a encontrar «Más sobre mí» como una pestaña de Mi perfil."]
      : [
          "Después de activar tu cuenta, entrá a Mi perfil → Más sobre mí. El enlace vale por unos días; si vence, respondé este correo y te mandamos otro.",
        ],
    signature: input.signature,
  });
}
