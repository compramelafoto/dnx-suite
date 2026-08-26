import {
  fromLegacyTemplateV2,
  toLegacyTemplateV2,
  parseTemplateDocument,
  type LegacyTemplateV2Payload,
  type TemplateDocument,
  type BridgeWarning,
} from "@repo/template-engine";
import type { TemplateV2SavePayloadCore } from "@/lib/template-v2/validate-save-payload";
import { TEMPLATE_V2_LIMITS, assertSafeAssetUrl } from "@/lib/template-v2/services/template-v2-limits";
import { TemplateV2DomainError } from "@/lib/template-v2/services/template-v2-errors";

export type DbBlockRow = {
  id: string;
  type: string;
  name: string | null;
  pageIndex?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  configJson: unknown;
};

export type DbBindingRow = {
  id: string;
  blockId: string;
  targetPath: string;
  variableKey: string;
  formatter: string | null;
  fallbackOverride: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function canvasFromJson(canvasJson: unknown): LegacyTemplateV2Payload["canvas"] {
  const c = asObject(canvasJson);
  const width =
    typeof c.width === "number" && Number.isFinite(c.width) ? c.width : 1200;
  const height =
    typeof c.height === "number" && Number.isFinite(c.height) ? c.height : 1800;
  return {
    width,
    height,
    background: typeof c.background === "string" ? c.background : undefined,
    dpi: typeof c.dpi === "number" ? c.dpi : undefined,
    bleedMm: typeof c.bleedMm === "number" ? c.bleedMm : undefined,
    safeAreaMm: typeof c.safeAreaMm === "number" ? c.safeAreaMm : undefined,
  };
}

export function dbBlocksToLegacy(
  blocks: DbBlockRow[]
): LegacyTemplateV2Payload["blocks"] {
  return blocks.map((b) => ({
    id: b.id,
    type: b.type as LegacyTemplateV2Payload["blocks"][number]["type"],
    name: b.name ?? undefined,
    pageIndex: typeof b.pageIndex === "number" ? b.pageIndex : 0,
    layout: {
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      rotation: b.rotation,
      zIndex: b.zIndex,
      opacity: b.opacity,
      locked: b.locked,
      visible: b.visible,
    },
    configJson: asObject(b.configJson),
  }));
}

export function dbBindingsToLegacy(
  bindings: DbBindingRow[]
): LegacyTemplateV2Payload["variableBindings"] {
  return bindings.map((vb) => ({
    id: vb.id,
    blockId: vb.blockId,
    targetPath: vb.targetPath,
    variableKey: vb.variableKey,
    formatter: vb.formatter ?? undefined,
    fallbackOverride: vb.fallbackOverride,
  }));
}

export function versionRowsToLegacyPayload(args: {
  canvasJson: unknown;
  metaJson: unknown;
  blocks: DbBlockRow[];
  bindings: DbBindingRow[];
}): LegacyTemplateV2Payload {
  return {
    canvas: canvasFromJson(args.canvasJson),
    blocks: dbBlocksToLegacy(args.blocks),
    variableBindings: dbBindingsToLegacy(args.bindings),
    meta: asObject(args.metaJson),
  };
}

export function legacyPayloadToCore(
  payload: LegacyTemplateV2Payload,
  options?: { id?: string; name?: string }
): { document: TemplateDocument; warnings: BridgeWarning[] } {
  const { document, warnings } = fromLegacyTemplateV2(payload, options);
  const parsed = parseTemplateDocument(document);
  if (!parsed.ok) {
    throw new TemplateV2DomainError(
      "TEMPLATE_INVALID",
      parsed.error,
      422,
      parsed.issues
    );
  }
  return { document: parsed.data, warnings };
}

export function coreToLegacyPayload(document: TemplateDocument): {
  payload: LegacyTemplateV2Payload;
  warnings: BridgeWarning[];
} {
  return toLegacyTemplateV2(document);
}

export function editorPayloadFromLegacy(payload: LegacyTemplateV2Payload): {
  canvas: LegacyTemplateV2Payload["canvas"];
  blocks: Array<{
    id: string;
    type: string;
    name?: string | null;
    pageIndex?: number;
    layout: LegacyTemplateV2Payload["blocks"][number]["layout"];
    configJson: Record<string, unknown>;
  }>;
  variableBindings: LegacyTemplateV2Payload["variableBindings"];
  meta: Record<string, unknown>;
} {
  return {
    canvas: payload.canvas,
    blocks: payload.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      name: b.name ?? null,
      pageIndex: b.pageIndex ?? 0,
      layout: b.layout,
      configJson: b.configJson,
    })),
    variableBindings: payload.variableBindings,
    meta: payload.meta,
  };
}

/** Valida límites estructurales sobre payload legacy/editor. */
export function assertLegacyPayloadLimits(payload: TemplateV2SavePayloadCore | LegacyTemplateV2Payload): void {
  const canvas = payload.canvas;
  if (
    canvas.width < TEMPLATE_V2_LIMITS.minCanvasWidth ||
    canvas.height < TEMPLATE_V2_LIMITS.minCanvasHeight ||
    canvas.width > TEMPLATE_V2_LIMITS.maxCanvasWidth ||
    canvas.height > TEMPLATE_V2_LIMITS.maxCanvasHeight
  ) {
    throw new TemplateV2DomainError(
      "TEMPLATE_INVALID",
      "Dimensiones de canvas fuera de rango",
      422
    );
  }
  if (payload.blocks.length > TEMPLATE_V2_LIMITS.maxBlocks) {
    throw new TemplateV2DomainError(
      "TEMPLATE_PAYLOAD_TOO_LARGE",
      `Demasiados bloques (máx ${TEMPLATE_V2_LIMITS.maxBlocks})`,
      413
    );
  }
  if (payload.variableBindings.length > TEMPLATE_V2_LIMITS.maxBindings) {
    throw new TemplateV2DomainError(
      "TEMPLATE_PAYLOAD_TOO_LARGE",
      `Demasiados bindings (máx ${TEMPLATE_V2_LIMITS.maxBindings})`,
      413
    );
  }

  const meta = "meta" in payload ? payload.meta : {};
  if (Object.keys(meta).length > TEMPLATE_V2_LIMITS.maxMetaKeys) {
    throw new TemplateV2DomainError(
      "TEMPLATE_PAYLOAD_TOO_LARGE",
      "Metadata excesiva",
      413
    );
  }

  for (const block of payload.blocks) {
    const cfg = block.configJson;
    const content = typeof cfg.content === "string" ? cfg.content : "";
    if (content.length > TEMPLATE_V2_LIMITS.maxTextLength) {
      throw new TemplateV2DomainError(
        "TEMPLATE_INVALID",
        `Texto excesivo en bloque ${block.id}`,
        422
      );
    }
    assertSafeAssetUrl(typeof cfg.src === "string" ? cfg.src : null);
    const source = asObject(cfg.source);
    assertSafeAssetUrl(typeof source.src === "string" ? source.src : null);
    assertSafeAssetUrl(typeof source.url === "string" ? source.url : null);

    // Bloques fuera del canvas (warning soft → error si completamente inválidos)
    if (
      !Number.isFinite(block.layout.width) ||
      !Number.isFinite(block.layout.height) ||
      block.layout.width <= 0 ||
      block.layout.height <= 0
    ) {
      throw new TemplateV2DomainError(
        "TEMPLATE_INVALID",
        `Layout inválido en bloque ${block.id}`,
        422
      );
    }
  }
}

export type TemplateSummary = {
  id: string;
  name: string;
  status: string;
  dimensions: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
  thumbnailUrl: string | null;
  ownerUserId: number;
  currentVersionId: string | null;
  schemaVersion: number;
  publication: { visibility: string; reviewStatus: string } | null;
};
