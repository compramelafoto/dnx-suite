import type { TemplateV2Preset } from "../clickaton/types";
import { buildSponsorThankYouPayload } from "./sponsor-thankyou-layout";

/**
 * FOTORANK_SPONSOR_THANKYOU_STORY_V1 — Story 1080×1920
 * Agradecimiento a un sponsor por acompañar un concurso de FotoRank.
 */
export const FOTORANK_SPONSOR_THANKYOU_STORY_V1: TemplateV2Preset = {
  presetId: "fotorank-sponsor-thankyou-story-v1",
  name: "Gracias sponsor — FotoRank",
  description:
    "Placa Instagram Story para agradecer a un sponsor su participación en un concurso de FotoRank.",
  meta: {
    product: "fotorank",
    templateKey: "FOTORANK_SPONSOR_THANKYOU_STORY_V1",
    templateVersion: 1,
    format: "instagram_story",
    purpose: "sponsor_thankyou",
    status: "published",
    createdAt: "2026-08-24",
    official: true,
  },
  payload: buildSponsorThankYouPayload({
    idPrefix: "fr-sponsor",
    background: "#050505",
    accent: "#D4AF37",
    accentSecondary: "#B8892D",
    textPrimary: "#FAFAFA",
    textMuted: "#C4C4C4",
    logoPlate: "#FAFAFA",
    titleFont: "Barlow Condensed",
    bodyFont: "DM Sans",
    title: "¡GRACIAS!",
  }),
};
