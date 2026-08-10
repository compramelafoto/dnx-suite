import type { DnxPartnerCampaignContextCategory } from "@repo/partners";

/** Inferencia conservadora de contexto CLF (sin categorías sensibles). */
export function inferClfContextCategories(input: {
  title?: string | null;
  tags?: readonly string[] | null;
}): DnxPartnerCampaignContextCategory[] {
  const blob = `${input.title ?? ""} ${(input.tags ?? []).join(" ")}`.toLowerCase();
  const out = new Set<DnxPartnerCampaignContextCategory>();
  if (/(xv|15\s*años|quince)/i.test(blob)) {
    out.add("XV");
    out.add("SOCIAL_EVENT");
  }
  if (/(boda|casamiento|wedding)/i.test(blob)) out.add("WEDDING");
  if (/(f[uú]tbol|basquet|deporte|running|maraton|hockey)/i.test(blob)) out.add("SPORTS");
  if (/(escuela|escolar|colegio|egresados|acto escolar)/i.test(blob)) {
    out.add("SCHOOL");
    out.add("EDUCATION");
  }
  if (/(foto|fotograf)/i.test(blob)) out.add("PHOTOGRAPHY");
  if (out.size === 0) out.add("EVENT");
  return [...out];
}
