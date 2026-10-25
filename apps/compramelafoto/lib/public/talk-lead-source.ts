/**
 * Origen de un inscripto a una charla: la etiqueta de la charla más la campaña que lo trajo
 * (el `utm_campaign` o el `ref` del enlace del anuncio o del correo). Sin campaña queda la
 * etiqueta sola, como hasta ahora, así los informes viejos siguen agrupando igual.
 */

const MAX_CAMPAIGN_LENGTH = 60;

/** Deja sólo letras, números, guiones y guiones bajos: el valor viene de la URL y se guarda tal cual. */
export function sanitizeCampaign(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_CAMPAIGN_LENGTH);
  return clean || null;
}

export function buildTalkLeadSource(tag: string, campaign: unknown): string {
  const clean = sanitizeCampaign(campaign);
  return clean ? `${tag}:${clean}` : tag;
}

/** Lee la campaña de los parámetros de la página: primero `utm_campaign`, después `ref`. */
export function campaignFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  return sanitizeCampaign(params.get("utm_campaign") ?? params.get("ref"));
}
