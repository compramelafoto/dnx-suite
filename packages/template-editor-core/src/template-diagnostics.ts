import { getSafeAreaRectPx } from "./get-safe-area-rect";
import { getLayoutSafeAreaStatus } from "./layout-vs-safe-area";
import {
  asObject,
  normalizeBlockConfig,
  type TemplateV2Block,
  type TemplateV2Canvas,
} from "./render-core";

export type TemplateDiagnosticIssue = {
  blockId: string;
  /** Clave estable para tests / futuro filtrado */
  code: string;
  /** Mensaje corto para la lista */
  problem: string;
};

const MIN_LAYOUT_DIM = 24;

/** Avisos que merecen borde más visible en el lienzo (config o layout grave). */
export const DIAGNOSTIC_STRONG_ISSUE_CODES = new Set([
  "safe_outside",
  "safe_partial",
  "image_no_src",
  "text_empty",
  "variable_no_key",
  "canvas_outside",
]);

/**
 * Por bloque: si hay algún aviso “fuerte”, `strong`; si solo hay otros (p. ej. hidden, tiny), `soft`.
 */
export function buildDiagnosticHighlightMap(
  issues: TemplateDiagnosticIssue[]
): Map<string, "strong" | "soft"> {
  const map = new Map<string, "strong" | "soft">();
  for (const issue of issues) {
    const tier: "strong" | "soft" = DIAGNOSTIC_STRONG_ISSUE_CODES.has(issue.code) ? "strong" : "soft";
    const prev = map.get(issue.blockId);
    if (prev === "strong") continue;
    map.set(issue.blockId, tier);
  }
  return map;
}

/**
 * Avisos no bloqueantes sobre el estado del template (editor).
 * Usa `normalizeBlockConfig` y el rect de zona segura alineado a ejes (sin rotación).
 */
export function collectTemplateDiagnostics(
  blocks: TemplateV2Block[],
  canvas: TemplateV2Canvas
): TemplateDiagnosticIssue[] {
  const safe = getSafeAreaRectPx(canvas);
  const cw = canvas.width;
  const ch = canvas.height;
  const issues: TemplateDiagnosticIssue[] = [];

  for (const b of blocks) {
    const cfg = normalizeBlockConfig(b.type, b.configJson);

    if (b.type === "IMAGE") {
      const src = String(cfg.src ?? "").trim();
      const source = asObject(cfg.source);
      const hasDynamicVar =
        typeof source.variableKey === "string" && String(source.variableKey).trim() !== "";
      if (!src && !hasDynamicVar) {
        issues.push({ blockId: b.id, code: "image_no_src", problem: "Imagen sin cargar" });
      }
    }

    if (b.type === "TEXT") {
      const content = String(cfg.content ?? "").trim();
      if (!content) {
        issues.push({ blockId: b.id, code: "text_empty", problem: "Texto vacío" });
      }
    }

    if (b.type === "VARIABLE_TEXT") {
      const vk = String(cfg.variableKey ?? "").trim();
      if (!vk) {
        issues.push({ blockId: b.id, code: "variable_no_key", problem: "Variable sin definir" });
      }
    }

    if (b.layout.visible === false) {
      issues.push({ blockId: b.id, code: "hidden", problem: "Oculto en el lienzo" });
    }

    const st = getLayoutSafeAreaStatus(b.layout, safe);
    if (st === "outside") {
      issues.push({ blockId: b.id, code: "safe_outside", problem: "Fuera de la zona segura" });
    } else if (st === "partial") {
      issues.push({ blockId: b.id, code: "safe_partial", problem: "Parcialmente fuera de la zona segura" });
    }

    const { x, y, width, height } = b.layout;
    if (width < MIN_LAYOUT_DIM || height < MIN_LAYOUT_DIM) {
      issues.push({ blockId: b.id, code: "tiny_block", problem: "Tamaño muy pequeño" });
    }

    const x2 = x + width;
    const y2 = y + height;
    const noCanvasOverlap = x2 < 0 || x > cw || y2 < 0 || y > ch;
    if (noCanvasOverlap) {
      issues.push({ blockId: b.id, code: "canvas_outside", problem: "Fuera del lienzo" });
    }
  }

  return issues;
}
