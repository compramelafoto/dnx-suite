import type { LegacyTemplateV2Payload } from "../../bridge";

export type TemplatePresetProduct = "school" | "clickaton";
export type TemplatePresetFormat = "instagram_story" | "print" | "custom";
export type TemplatePresetStatus = "draft" | "published" | "deprecated";

export type TemplatePresetMeta = {
  product: TemplatePresetProduct;
  templateKey: string;
  templateVersion: number;
  format: TemplatePresetFormat;
  purpose: string;
  status: TemplatePresetStatus;
  createdAt: string;
  official: true;
};

export type TemplateV2Preset = {
  /** ID lógico del preset (no es ID de DB). */
  presetId: string;
  name: string;
  description: string;
  meta: TemplatePresetMeta;
  /** Documento legacy listo para create/save (IDs de bloque serán regenerados al instanciar). */
  payload: LegacyTemplateV2Payload;
};

/** Alias canónico para presets oficiales Clickatón. */
export type ClickatonTemplatePreset = TemplateV2Preset;
