/**
 * Slug de la charla en `Talk` (Admin → Comunicaciones → Charlas).
 * La migración `20260510193000_talk_lead_sfpr_charla_talk` inserta este registro si no existe.
 */
export const CHARLAS_FPR_TALK_SLUG =
  process.env.CHARLAS_FPR_TALK_SLUG?.trim() || "charlasfpr-sfpr-rosario-mayo";
