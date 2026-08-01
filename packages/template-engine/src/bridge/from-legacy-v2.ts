import { TEMPLATE_SCHEMA_VERSION } from "../core/constants";
import type { TemplateBlock, TemplateBlockType } from "../schema/blocks";
import type { FromLegacyResult, LegacyTemplateV2Payload } from "./types";

const KNOWN_TYPES = new Set<string>([
  "BACKGROUND",
  "PHOTO",
  "TEXT",
  "VARIABLE_TEXT",
  "IMAGE",
  "SHAPE",
]);

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

/**
 * Convierte payload Template V2 (editor/save) → TemplateDocument canónico.
 */
export function fromLegacyTemplateV2(
  legacy: LegacyTemplateV2Payload,
  options?: { id?: string; name?: string }
): FromLegacyResult {
  const warnings: FromLegacyResult["warnings"] = [];
  const canvas = legacy.canvas;
  const meta = legacy.meta && typeof legacy.meta === "object" ? { ...legacy.meta } : {};

  const blocks: TemplateBlock[] = [];
  for (const b of legacy.blocks ?? []) {
    if (!KNOWN_TYPES.has(b.type)) {
      warnings.push({
        code: "unknown_block_type",
        message: `tipo de bloque no soportado: ${String(b.type)}`,
        field: b.id,
      });
      continue;
    }
    const config = asObject(b.configJson);
    // Preservar claves desconocidas en config
    blocks.push({
      id: b.id,
      type: b.type as TemplateBlockType,
      pageIndex: b.pageIndex ?? 0,
      name: b.name ?? null,
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
      config,
    });
  }

  const nameFromMeta =
    typeof meta.name === "string" && meta.name.trim()
      ? meta.name
      : typeof meta.templateName === "string"
        ? meta.templateName
        : undefined;

  const metadata: Record<string, unknown> = {
    ...meta,
    legacySource: "template-v2",
  };

  // Campos canvas desconocidos → metadata
  for (const [key, value] of Object.entries(canvas as Record<string, unknown>)) {
    if (
      !["width", "height", "background", "dpi", "bleedMm", "safeAreaMm"].includes(key)
    ) {
      warnings.push({
        code: "unmapped_canvas_field",
        message: `campo canvas no mapeado preservado en metadata: ${key}`,
        field: key,
      });
      metadata[`canvas.${key}`] = value;
    }
  }

  const document = {
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    id: options?.id,
    name: options?.name ?? nameFromMeta ?? "Template V2",
    width: canvas.width,
    height: canvas.height,
    unit: "px" as const,
    background: canvas.background
      ? { color: canvas.background }
      : undefined,
    print: {
      dpi: canvas.dpi,
      bleedMm: canvas.bleedMm,
      safeAreaMm: canvas.safeAreaMm,
    },
    blocks,
    bindings: (legacy.variableBindings ?? []).map((vb) => ({
      id: vb.id,
      blockId: vb.blockId,
      targetPath: vb.targetPath,
      variableKey: vb.variableKey,
      formatter: vb.formatter,
      fallbackOverride: vb.fallbackOverride,
    })),
    metadata,
  };

  return { document, warnings };
}
