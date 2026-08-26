import {
  getResolvedVariableText,
  getTextVisualConfig,
  normalizeBlockConfig,
  type TemplateV2BlockType,
} from "@/lib/template-v2/render-core";

const MIN_PX = 24;

/**
 * Calcula el tamaño del recuadro que envuelve el texto con la misma tipografía que el lienzo.
 * Si el texto es más ancho que el espacio disponible hacia la derecha del bloque, limita el ancho y envuelve líneas.
 */
export function measureTextBlockBoundsPx(args: {
  type: Extract<TemplateV2BlockType, "TEXT" | "VARIABLE_TEXT">;
  configJson: Record<string, unknown>;
  resolvedVariables?: Record<string, unknown>;
  canvasWidth: number;
  /** Posición X del bloque en coords de lienzo (para no desbordar a la derecha). */
  layoutX: number;
}): { width: number; height: number } {
  if (typeof document === "undefined") {
    return { width: MIN_PX, height: MIN_PX };
  }

  const cfgNorm = normalizeBlockConfig(args.type, args.configJson) as Record<string, unknown>;
  const visualCfg =
    args.type === "VARIABLE_TEXT"
      ? { ...cfgNorm, content: String(cfgNorm.fallback ?? "") }
      : cfgNorm;

  const displayText =
    args.type === "TEXT"
      ? String(cfgNorm.content ?? "")
      : getResolvedVariableText(cfgNorm, args.resolvedVariables);

  const t = getTextVisualConfig(visualCfg);

  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.position = "absolute";
  el.style.left = "-99999px";
  el.style.top = "0";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  el.style.boxSizing = "border-box";
  el.style.margin = "0";
  el.style.padding = "0";
  el.style.whiteSpace = "pre-wrap";
  el.style.wordBreak = "break-word";
  /** Medición ajustada al texto: block + overflow:hidden puede inflar scrollHeight respecto al contenido. */
  el.style.display = "inline-block";
  el.style.verticalAlign = "top";
  el.style.overflow = "visible";
  el.style.color = t.color;
  el.style.fontFamily = t.fontFamilyCss;
  el.style.fontSize = `${t.fontSize}px`;
  el.style.fontWeight = String(t.fontWeight);
  el.style.fontStyle = t.fontStyle;
  el.style.textDecoration = t.textDecoration;
  el.style.lineHeight = String(t.lineHeight);
  el.style.letterSpacing = `${t.letterSpacing}px`;
  el.style.textAlign = t.textAlign;

  el.textContent = displayText === "" ? "\u00a0" : displayText;

  document.body.appendChild(el);

  const maxAllowedW = Math.max(MIN_PX, args.canvasWidth - args.layoutX);

  el.style.width = "max-content";
  el.style.maxWidth = "none";
  const intrinsicW = el.scrollWidth;
  const intrinsicH = el.scrollHeight;

  let width: number;
  let height: number;

  if (intrinsicW <= maxAllowedW) {
    width = Math.max(MIN_PX, Math.ceil(intrinsicW));
    height = Math.max(MIN_PX, Math.ceil(intrinsicH));
  } else {
    el.style.display = "block";
    el.style.width = `${maxAllowedW}px`;
    el.style.overflow = "hidden";
    width = maxAllowedW;
    height = Math.max(MIN_PX, Math.ceil(el.scrollHeight));
  }

  document.body.removeChild(el);

  return { width, height };
}
