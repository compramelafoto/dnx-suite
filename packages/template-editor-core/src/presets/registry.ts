import { CLICKATON_MEMBER_STORY_V1 } from "../presets/clickaton/clickaton-member-story-v1";
import { CLICKATON_WELCOME_STORY_V1 } from "../presets/clickaton/clickaton-welcome-story-v1";
import type {
  TemplatePresetFormat,
  TemplatePresetProduct,
  TemplatePresetStatus,
  TemplateV2Preset,
} from "../presets/types";
import { parseTemplateV2EditorPayload } from "../validate-save-payload";

const PRESETS: TemplateV2Preset[] = [
  CLICKATON_WELCOME_STORY_V1,
  CLICKATON_MEMBER_STORY_V1,
];

export type ListTemplatePresetsFilter = {
  product?: TemplatePresetProduct;
  purpose?: string;
  format?: TemplatePresetFormat;
  status?: TemplatePresetStatus;
};

export function listTemplatePresets(
  filter?: ListTemplatePresetsFilter
): TemplateV2Preset[] {
  return PRESETS.filter((p) => {
    if (filter?.product && p.meta.product !== filter.product) return false;
    if (filter?.purpose && p.meta.purpose !== filter.purpose) return false;
    if (filter?.format && p.meta.format !== filter.format) return false;
    if (filter?.status && p.meta.status !== filter.status) return false;
    return true;
  }).map((p) => structuredClone(p));
}

export function getTemplatePreset(presetIdOrKey: string): TemplateV2Preset | null {
  const found = PRESETS.find(
    (p) =>
      p.presetId === presetIdOrKey ||
      p.meta.templateKey === presetIdOrKey
  );
  return found ? structuredClone(found) : null;
}

const SCHOOL_PREFIXES = [
  "student.",
  "school.",
  "course.",
  "buyer.",
  "order.",
  "photographer.",
];

export function validateTemplatePreset(preset: TemplateV2Preset): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!preset.presetId) errors.push("presetId requerido");
  if (!preset.meta.templateKey) errors.push("templateKey requerido");
  if (!preset.meta.product) errors.push("product requerido");

  const canvas = preset.payload.canvas;
  if (preset.meta.format === "instagram_story") {
    if (canvas.width !== 1080 || canvas.height !== 1920) {
      errors.push("instagram_story debe ser 1080×1920");
    }
  }

  const parsed = parseTemplateV2EditorPayload(preset.payload);
  if (!parsed.ok) {
    errors.push(`payload inválido: ${parsed.error}`);
  }

  const ids = new Set<string>();
  for (const b of preset.payload.blocks) {
    if (ids.has(b.id)) errors.push(`block id duplicado: ${b.id}`);
    ids.add(b.id);
  }

  if (preset.meta.product === "clickaton") {
    for (const vb of preset.payload.variableBindings ?? []) {
      for (const prefix of SCHOOL_PREFIXES) {
        if (vb.variableKey.startsWith(prefix)) {
          errors.push(`binding escolar en preset Clickatón: ${vb.variableKey}`);
        }
      }
    }
    for (const b of preset.payload.blocks) {
      if (b.type === "TEXT" || b.type === "VARIABLE_TEXT") {
        const content = String(b.configJson.content ?? "");
        const key = String(b.configJson.variableKey ?? "");
        for (const prefix of SCHOOL_PREFIXES) {
          if (content.includes(`{${prefix}`) || key.startsWith(prefix)) {
            errors.push(`variable escolar en bloque ${b.id}`);
          }
        }
      }
    }

    const requiredWelcome = [
      "participant.fullName",
      "participant.photoUrl",
      "edition.name",
    ];
    const keys = new Set(
      (preset.payload.variableBindings ?? []).map((v) => v.variableKey)
    );
    // también en TEXT braces
    const blob = JSON.stringify(preset.payload);
    if (preset.meta.templateKey === "CLICKATON_WELCOME_STORY_V1") {
      for (const r of [...requiredWelcome, "edition.eventDate"]) {
        if (
          !keys.has(r) &&
          !blob.includes(r) &&
          !(r === "edition.eventDate" && blob.includes("edition.eventDateFormatted"))
        ) {
          warnings.push(`recomendado ausente: ${r}`);
        }
      }
      if (!keys.has("participant.fullName")) {
        errors.push("Welcome requiere participant.fullName");
      }
      if (!keys.has("participant.photoUrl")) {
        errors.push("Welcome requiere participant.photoUrl");
      }
    }
    if (preset.meta.templateKey === "CLICKATON_MEMBER_STORY_V1") {
      if (!keys.has("participant.fullName")) {
        errors.push("Member requiere participant.fullName");
      }
      if (!keys.has("participant.photoUrl")) {
        errors.push("Member requiere participant.photoUrl");
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
