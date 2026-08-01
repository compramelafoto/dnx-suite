import type { LegacyTemplateV2Payload } from "../../bridge";
import { CLICKATON_MEMBER_STORY_V1 } from "./member-story-v1";
import { instantiatePresetPayload } from "./preset-helpers";
import type { ClickatonTemplatePreset } from "./types";
import { CLICKATON_WELCOME_STORY_V1 } from "./welcome-story-v1";

export type {
  ClickatonTemplatePreset,
  TemplatePresetFormat,
  TemplatePresetMeta,
  TemplatePresetProduct,
  TemplatePresetStatus,
  TemplateV2Preset,
} from "./types";
export { layout, instantiatePresetPayload } from "./preset-helpers";
export { CLICKATON_WELCOME_STORY_V1 } from "./welcome-story-v1";
export { CLICKATON_MEMBER_STORY_V1 } from "./member-story-v1";

const PRESETS: ClickatonTemplatePreset[] = [
  CLICKATON_WELCOME_STORY_V1,
  CLICKATON_MEMBER_STORY_V1,
];

export function listClickatonTemplatePresets(): ClickatonTemplatePreset[] {
  return PRESETS.map((p) => structuredClone(p));
}

export function getClickatonTemplatePreset(
  presetIdOrKey: string
): ClickatonTemplatePreset | null {
  const found = PRESETS.find(
    (p) =>
      p.presetId === presetIdOrKey || p.meta.templateKey === presetIdOrKey
  );
  return found ? structuredClone(found) : null;
}

export function instantiateClickatonTemplatePreset(
  preset: ClickatonTemplatePreset
): LegacyTemplateV2Payload {
  return instantiatePresetPayload(preset);
}
