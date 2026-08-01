/**
 * Aliases legibles Clickatón → paths canónicos.
 */
export const CLICKATON_TEMPLATE_ALIASES: Record<string, string> = {
  participante: "participant.fullName",
  nombre: "participant.fullName",
  nombrecompleto: "participant.fullName",
  instagram: "participant.instagramHandle",
  ig: "participant.instagramHandle",
  ciudad: "participant.city",
  categoria: "participant.category",
  numero: "participant.numberFormatted",
  dorsal: "participant.numberFormatted",
  foto: "participant.photoUrl",
  edicion: "edition.name",
  fecha: "edition.eventDateFormatted",
  logo: "branding.logoUrl",
};
