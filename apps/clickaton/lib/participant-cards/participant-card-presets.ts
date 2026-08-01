/**
 * Presets oficiales Clickatón — re-export desde fuente única del package.
 * No duplicar definiciones visuales aquí.
 */
import {
  CLICKATON_MEMBER_STORY_V1 as PACKAGE_MEMBER,
  CLICKATON_WELCOME_STORY_V1 as PACKAGE_WELCOME,
  getClickatonTemplatePreset,
  instantiateClickatonTemplatePreset,
  layout as packageLayout,
  type ClickatonTemplatePreset,
} from "@repo/template-engine/clickaton-presets";
import type { LegacyTemplateV2Payload } from "@repo/template-engine";
import type { ClickatonParticipantCardType } from "./participant-card-types";

export type ClickatonCardPreset = ClickatonTemplatePreset;

export const CLICKATON_WELCOME_STORY_V1 = PACKAGE_WELCOME;
export const CLICKATON_MEMBER_STORY_V1 = PACKAGE_MEMBER;

export const layout = packageLayout;

export function instantiatePresetPayload(
  preset: ClickatonCardPreset
): LegacyTemplateV2Payload {
  return instantiateClickatonTemplatePreset(preset);
}

export function getClickatonParticipantCardPreset(
  cardType: ClickatonParticipantCardType
): ClickatonCardPreset {
  const key =
    cardType === "welcome"
      ? "CLICKATON_WELCOME_STORY_V1"
      : "CLICKATON_MEMBER_STORY_V1";
  const preset = getClickatonTemplatePreset(key);
  if (!preset) {
    throw new Error(`Preset Clickatón no encontrado: ${key}`);
  }
  return preset;
}

export function normalizeParticipantCardType(
  raw: ClickatonParticipantCardType | "WELCOME" | "MEMBER" | string
): ClickatonParticipantCardType {
  const v = String(raw).trim().toLowerCase();
  if (v === "welcome" || v === "bienvenida") return "welcome";
  if (v === "member" || v === "soy-parte" || v === "miembro") return "member";
  throw new Error(`Tipo de placa desconocido: ${raw}`);
}

export {
  getClickatonTemplatePreset,
  listClickatonTemplatePresets,
  instantiateClickatonTemplatePreset,
} from "@repo/template-engine/clickaton-presets";
