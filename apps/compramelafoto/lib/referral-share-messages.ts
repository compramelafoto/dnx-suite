export type ReferralShareMessages = {
  defaultMessage: string;
  whatsapp: string;
  instagramDm: string;
  short: string;
};

/**
 * Textos sugeridos para compartir el link de referido (castellano argentino, tono sobrio).
 */
export function buildReferralAmbassadorMessages(referralLink: string): ReferralShareMessages {
  const defaultMessage =
    `Te comparto ComprameLaFoto, una plataforma pensada para fotógrafos que quieren vender sus fotos de forma más ordenada y profesional. Si querés verla, entrá desde mi link: ${referralLink}`;

  const whatsapp =
    `Hola 👋 Te paso ComprameLaFoto: es para fotógrafos que quieren vender online más ordenado. Si querés chusmear: ${referralLink}`;

  const instagramDm =
    `Te dejo ComprameLaFoto por si te interesa (fotógrafos vendiendo online más prolijo): ${referralLink}`;

  const short = `ComprameLaFoto — miralo acá: ${referralLink}`;

  return { defaultMessage, whatsapp, instagramDm, short };
}
