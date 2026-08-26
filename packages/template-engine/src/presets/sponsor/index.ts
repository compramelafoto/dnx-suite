import type { LegacyTemplateV2Payload } from "../../bridge";
import { instantiatePresetPayload } from "../clickaton/preset-helpers";
import type { TemplateV2Preset } from "../clickaton/types";
import { CLICKATON_SPONSOR_THANKYOU_STORY_V1 } from "./clickaton-sponsor-thankyou-story-v1";
import { FOTORANK_SPONSOR_THANKYOU_STORY_V1 } from "./fotorank-sponsor-thankyou-story-v1";

export { CLICKATON_SPONSOR_THANKYOU_STORY_V1 } from "./clickaton-sponsor-thankyou-story-v1";
export { FOTORANK_SPONSOR_THANKYOU_STORY_V1 } from "./fotorank-sponsor-thankyou-story-v1";
export {
  buildSponsorThankYouPayload,
  SPONSOR_STORY_HEIGHT,
  SPONSOR_STORY_WIDTH,
  type SponsorThankYouTheme,
} from "./sponsor-thankyou-layout";

export type SponsorThankYouProduct = "clickaton" | "fotorank";

const PRESETS: TemplateV2Preset[] = [
  CLICKATON_SPONSOR_THANKYOU_STORY_V1,
  FOTORANK_SPONSOR_THANKYOU_STORY_V1,
];

export function listSponsorThankYouPresets(): TemplateV2Preset[] {
  return PRESETS.map((p) => structuredClone(p));
}

export function getSponsorThankYouPreset(
  presetIdOrKey: string
): TemplateV2Preset | null {
  const found = PRESETS.find(
    (p) => p.presetId === presetIdOrKey || p.meta.templateKey === presetIdOrKey
  );
  return found ? structuredClone(found) : null;
}

export function getSponsorThankYouPresetForProduct(
  product: SponsorThankYouProduct
): TemplateV2Preset {
  const preset =
    product === "fotorank"
      ? FOTORANK_SPONSOR_THANKYOU_STORY_V1
      : CLICKATON_SPONSOR_THANKYOU_STORY_V1;
  return structuredClone(preset);
}

export function instantiateSponsorThankYouPreset(
  preset: TemplateV2Preset
): LegacyTemplateV2Payload {
  return instantiatePresetPayload(preset);
}
