/**
 * `crypto.randomUUID()` global en vez de `node:crypto`: estos presets los
 * alcanza también el lienzo del editor, que corre en el navegador.
 */
import type { LegacyTemplateV2Payload } from "../../bridge";
import type { TemplateV2Preset } from "./types";

export function layout(
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  extra?: Partial<{
    rotation: number;
    opacity: number;
    locked: boolean;
    visible: boolean;
  }>
) {
  return {
    x,
    y,
    width,
    height,
    rotation: extra?.rotation ?? 0,
    zIndex,
    opacity: extra?.opacity ?? 1,
    locked: extra?.locked ?? false,
    visible: extra?.visible ?? true,
  };
}

/** Copia un preset regenerando IDs de bloques y bindings (no muta el original). */
export function instantiatePresetPayload(
  preset: TemplateV2Preset
): LegacyTemplateV2Payload {
  const idMap = new Map<string, string>();
  const blocks = preset.payload.blocks.map((b) => {
    const newId = crypto.randomUUID();
    idMap.set(b.id, newId);
    return {
      ...b,
      id: newId,
      configJson: { ...b.configJson },
      layout: { ...b.layout },
    };
  });
  const variableBindings = (preset.payload.variableBindings ?? []).map((vb) => ({
    ...vb,
    id: crypto.randomUUID(),
    blockId: idMap.get(vb.blockId) ?? vb.blockId,
  }));
  return {
    canvas: { ...preset.payload.canvas },
    blocks,
    variableBindings,
    meta: {
      ...preset.payload.meta,
      ...preset.meta,
      presetId: preset.presetId,
      instantiatedFromPreset: true,
      instantiatedAt: new Date().toISOString(),
    },
  };
}
