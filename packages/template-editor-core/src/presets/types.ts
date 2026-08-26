import type { LegacyTemplateV2Payload } from "@repo/template-engine";

// Debe reflejar el mismo tipo de @repo/template-engine
// (packages/template-engine/src/presets/clickaton/types.ts).
export type TemplatePresetProduct = "school" | "clickaton" | "fotorank";
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
