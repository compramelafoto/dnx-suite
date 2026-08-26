import type { TemplateV2Preset } from "../clickaton/types";
import { buildSponsorThankYouPayload } from "./sponsor-thankyou-layout";

/**
 * CLICKATON_SPONSOR_THANKYOU_STORY_V1 — Story 1080×1920
 * Agradecimiento a un sponsor por acompañar una edición de Clickatón.
 */
export const CLICKATON_SPONSOR_THANKYOU_STORY_V1: TemplateV2Preset = {
  presetId: "clickaton-sponsor-thankyou-story-v1",
  name: "Gracias sponsor — Clickatón",
  description:
    "Placa Instagram Story para agradecer a un sponsor su participación en Clickatón.",
  meta: {
    product: "clickaton",
    templateKey: "CLICKATON_SPONSOR_THANKYOU_STORY_V1",
    templateVersion: 1,
    format: "instagram_story",
    purpose: "sponsor_thankyou",
    status: "published",
    createdAt: "2026-08-24",
    official: true,
  },
  payload: buildSponsorThankYouPayload({
    idPrefix: "clk-sponsor",
    background: "#000000",
    accent: "#FFE600",
    accentSecondary: "#3B1F6E",
    textPrimary: "#FFFFFF",
    textMuted: "#E5E5E5",
    logoPlate: "#FFFFFF",
    titleFont: "Barlow Condensed",
    bodyFont: "DM Sans",
    title: "¡GRACIAS!",
  }),
};
