import { TEMPLATE_V2_VARIABLE_MAP, isTemplateV2VariableUsableIn } from "@/lib/template-v2/variable-catalog";

export type TemplateV2SaveBlockType =
  | "BACKGROUND"
  | "PHOTO"
  | "TEXT"
  | "VARIABLE_TEXT"
  | "IMAGE"
  | "SHAPE";

export type TemplateV2SavePayloadCore = {
  canvas: {
    width: number;
    height: number;
    background?: string;
    dpi?: number;
    bleedMm?: number;
    safeAreaMm?: number;
  };
  blocks: Array<{
    id: string;
    type: TemplateV2SaveBlockType;
    name?: string;
    /** Hoja (0-based); si falta, 0. */
    pageIndex?: number;
    layout: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      zIndex: number;
      opacity: number;
      locked?: boolean;
      visible: boolean;
    };
    configJson: Record<string, unknown>;
  }>;
  variableBindings: Array<{
    id?: string;
    blockId: string;
    targetPath: string;
    variableKey: string;
    formatter?: string;
    fallbackOverride?: string | null;
  }>;
  meta: Record<string, unknown>;
};

const ALLOWED_BLOCK_TYPES: Set<string> = new Set([
  "BACKGROUND",
  "PHOTO",
  "TEXT",
  "VARIABLE_TEXT",
  "IMAGE",
  "SHAPE",
]);

const ALLOWED_TARGET_PATHS: Record<TemplateV2SaveBlockType, Set<string>> = {
  BACKGROUND: new Set(),
  PHOTO: new Set(),
  TEXT: new Set(["content.value", "content"]),
  VARIABLE_TEXT: new Set(["variableKey", "fallback", "content"]),
  IMAGE: new Set(["source.variableKey", "source.src", "src"]),
  SHAPE: new Set(),
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateCanvas(canvas: TemplateV2SavePayloadCore["canvas"]): string | null {
  if (!canvas || !isFiniteNumber(canvas.width) || !isFiniteNumber(canvas.height)) {
    return "canvas inválido";
  }
  if (canvas.width <= 0 || canvas.height <= 0) {
    return "canvas.width y canvas.height deben ser > 0";
  }
  if (canvas.dpi !== undefined && (!isFiniteNumber(canvas.dpi) || canvas.dpi <= 0)) {
    return "canvas.dpi inválido";
  }
  if (canvas.bleedMm !== undefined && (!isFiniteNumber(canvas.bleedMm) || canvas.bleedMm < 0)) {
    return "canvas.bleedMm inválido";
  }
  if (canvas.safeAreaMm !== undefined && (!isFiniteNumber(canvas.safeAreaMm) || canvas.safeAreaMm < 0)) {
    return "canvas.safeAreaMm inválido";
  }
  if (canvas.background !== undefined && typeof canvas.background !== "string") {
    return "canvas.background inválido";
  }
  return null;
}

function validateLayout(layout: TemplateV2SavePayloadCore["blocks"][number]["layout"]): string | null {
  if (
    !isFiniteNumber(layout.x) ||
    !isFiniteNumber(layout.y) ||
    !isFiniteNumber(layout.width) ||
    !isFiniteNumber(layout.height) ||
    !isFiniteNumber(layout.rotation) ||
    !isFiniteNumber(layout.zIndex) ||
    !isFiniteNumber(layout.opacity) ||
    typeof layout.visible !== "boolean"
  ) {
    return "layout inválido";
  }
  if (layout.width <= 0 || layout.height <= 0) {
    return "layout.width y layout.height deben ser > 0";
  }
  if (layout.opacity < 0 || layout.opacity > 1) {
    return "layout.opacity debe estar entre 0 y 1";
  }
  if (layout.locked !== undefined && typeof layout.locked !== "boolean") {
    return "layout.locked inválido";
  }
  return null;
}

/**
 * Valida canvas, blocks y variableBindings del editor (mismo criterio que PUT save).
 */
export function parseTemplateV2EditorPayload(body: unknown):
  | { ok: false; error: string }
  | { ok: true; data: TemplateV2SavePayloadCore } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "body inválido" };
  }
  const b = body as Record<string, unknown>;
  const blocks = Array.isArray(b.blocks) ? b.blocks : [];
  const variableBindings = Array.isArray(b.variableBindings) ? b.variableBindings : [];
  const canvas = b.canvas as TemplateV2SavePayloadCore["canvas"] | undefined;
  const meta = b.meta && typeof b.meta === "object" && !Array.isArray(b.meta) ? (b.meta as Record<string, unknown>) : {};

  if (!canvas) {
    return { ok: false, error: "canvas requerido" };
  }

  const canvasErr = validateCanvas(canvas);
  if (canvasErr) {
    return { ok: false, error: canvasErr };
  }

  const blockIds = new Set<string>();
  const blockTypeById = new Map<string, TemplateV2SaveBlockType>();
  for (const block of blocks) {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      return { ok: false, error: "bloque inválido" };
    }
    const bl = block as Record<string, unknown>;
    if (typeof bl.id !== "string" || bl.id.trim() === "") {
      return { ok: false, error: "block.id inválido" };
    }
    if (blockIds.has(bl.id)) {
      return { ok: false, error: "block ids duplicados" };
    }
    blockIds.add(bl.id);

    if (typeof bl.type !== "string" || !ALLOWED_BLOCK_TYPES.has(bl.type)) {
      return { ok: false, error: `block.type inválido (${String(bl.type)})` };
    }
    const bt = bl.type as TemplateV2SaveBlockType;
    blockTypeById.set(bl.id, bt);

    if (!bl.layout || typeof bl.layout !== "object" || Array.isArray(bl.layout)) {
      return { ok: false, error: "layout requerido en bloque" };
    }
    const layoutErr = validateLayout(bl.layout as TemplateV2SavePayloadCore["blocks"][number]["layout"]);
    if (layoutErr) {
      return { ok: false, error: layoutErr };
    }

    if (!bl.configJson || typeof bl.configJson !== "object" || Array.isArray(bl.configJson)) {
      return { ok: false, error: "configJson inválido" };
    }

    if (bl.pageIndex !== undefined) {
      const pi = bl.pageIndex;
      if (typeof pi !== "number" || !Number.isInteger(pi) || pi < 0) {
        return { ok: false, error: "block.pageIndex inválido" };
      }
    }
  }

  for (const binding of variableBindings) {
    if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
      return { ok: false, error: "binding inválido" };
    }
    const vb = binding as Record<string, unknown>;
    if (typeof vb.blockId !== "string" || !blockTypeById.has(vb.blockId)) {
      return { ok: false, error: "binding.blockId inválido" };
    }
    if (typeof vb.targetPath !== "string" || vb.targetPath.trim() === "") {
      return { ok: false, error: "binding.targetPath inválido" };
    }
    if (typeof vb.variableKey !== "string" || !TEMPLATE_V2_VARIABLE_MAP[vb.variableKey]) {
      return { ok: false, error: "binding.variableKey inválido" };
    }

    const blockType = blockTypeById.get(vb.blockId)!;
    const allowedPaths = ALLOWED_TARGET_PATHS[blockType];
    if (!allowedPaths.has(vb.targetPath)) {
      return { ok: false, error: `targetPath no permitido para bloque ${blockType}` };
    }

    const target: "TEXT" | "IMAGE" =
      blockType === "TEXT" || blockType === "VARIABLE_TEXT" ? "TEXT" : "IMAGE";
    if (!isTemplateV2VariableUsableIn(vb.variableKey, target)) {
      return { ok: false, error: `variableKey no compatible con bloque ${blockType}` };
    }
  }

  const blocksOut: TemplateV2SavePayloadCore["blocks"] = (blocks as TemplateV2SavePayloadCore["blocks"]).map((b) => ({
    ...b,
    pageIndex: b.pageIndex ?? 0,
  }));

  return {
    ok: true,
    data: {
      canvas,
      blocks: blocksOut,
      variableBindings: variableBindings as TemplateV2SavePayloadCore["variableBindings"],
      meta,
    },
  };
}
