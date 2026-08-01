import type { ToLegacyResult, LegacyTemplateV2Payload } from "./types";
import type { TemplateDocument } from "../schema/document";

/**
 * Convierte TemplateDocument canónico → payload Template V2.
 */
export function toLegacyTemplateV2(document: TemplateDocument): ToLegacyResult {
  const warnings: ToLegacyResult["warnings"] = [];

  if (document.unit !== "px") {
    warnings.push({
      code: "unsupported_unit",
      message: `unit "${document.unit}" no existe en legacy; se asume px`,
      field: "unit",
    });
  }

  if (document.schemaVersion !== 1) {
    warnings.push({
      code: "schema_version",
      message: `schemaVersion ${document.schemaVersion} — mapeo best-effort`,
      field: "schemaVersion",
    });
  }

  const meta: Record<string, unknown> = { ...(document.metadata ?? {}) };
  delete meta.legacySource;

  // Restaurar campos canvas.* preservados
  const canvasExtras: Record<string, unknown> = {};
  for (const key of Object.keys(meta)) {
    if (key.startsWith("canvas.")) {
      canvasExtras[key.slice("canvas.".length)] = meta[key];
      delete meta[key];
    }
  }

  const payload: LegacyTemplateV2Payload = {
    canvas: {
      width: document.width,
      height: document.height,
      background: document.background?.color,
      dpi: document.print?.dpi,
      bleedMm: document.print?.bleedMm,
      safeAreaMm: document.print?.safeAreaMm,
      ...canvasExtras,
    },
    blocks: document.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      name: b.name ?? undefined,
      pageIndex: b.pageIndex ?? 0,
      layout: {
        x: b.layout.x,
        y: b.layout.y,
        width: b.layout.width,
        height: b.layout.height,
        rotation: b.layout.rotation ?? 0,
        zIndex: b.layout.zIndex ?? 0,
        opacity: b.layout.opacity ?? 1,
        locked: b.layout.locked,
        visible: b.layout.visible ?? true,
      },
      configJson: { ...(b.config ?? {}) },
    })),
    variableBindings: (document.bindings ?? []).map((vb) => ({
      id: vb.id,
      blockId: vb.blockId,
      targetPath: vb.targetPath,
      variableKey: vb.variableKey,
      formatter: vb.formatter,
      fallbackOverride: vb.fallbackOverride,
    })),
    meta,
  };

  if (document.background?.src) {
    warnings.push({
      code: "background_src",
      message: "background.src canónico no tiene campo directo en canvas legacy; vive en bloque BACKGROUND",
      field: "background.src",
    });
  }

  return { payload, warnings };
}
