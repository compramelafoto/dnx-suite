import type { ResolvedTemplateDocument } from "@repo/template-engine";
import { resolvePreviewAssetSrc } from "./asset-resolver";
import {
  backgroundImageStyle,
  buildPreviewDocumentCss,
  imageMaskStyle,
  layoutStyle,
  objectFitStyle,
  typographyStyle,
} from "./css-builder";
import {
  escapeHtml,
  sanitizeCssColor,
} from "./html-escape";
import { buildPreviewFontFaceCss } from "./font-resolver";

export type PreviewHtmlBuildResult = {
  html: string;
  warnings: string[];
  imageCount: number;
  blockCount: number;
};

function asConfig(block: { config?: unknown }): Record<string, unknown> {
  if (!block.config || typeof block.config !== "object" || Array.isArray(block.config)) {
    return {};
  }
  return block.config as Record<string, unknown>;
}

function renderBlockHtml(
  block: ResolvedTemplateDocument["blocks"][number],
  warnings: string[]
): string {
  if (block.layout.visible === false) return "";
  const cfg = asConfig(block);
  const style = layoutStyle(block.layout);
  const idAttr = escapeHtml(block.id);

  switch (block.type) {
    case "BACKGROUND": {
      const color = sanitizeCssColor(cfg.backgroundColor, "#ffffff");
      const asset = resolvePreviewAssetSrc(cfg.src, { optional: true });
      if (asset.warning) warnings.push(asset.warning);
      const bg =
        asset.src.length > 0
          ? backgroundImageStyle(asset.src, cfg.fit)
          : `background-color:${color};`;
      return `<div class="block" data-block-id="${idAttr}" data-type="BACKGROUND" style="${style};${bg}"></div>`;
    }
    case "SHAPE": {
      const variant = String(cfg.variant ?? "rectangle");
      const fill = sanitizeCssColor(cfg.fill, "#e5e7eb");
      const stroke = sanitizeCssColor(cfg.stroke, "#94a3b8");
      const sw = Number(cfg.strokeWidth) || 0;
      const radius = Number(cfg.radius) || 0;
      const round =
        variant === "circle" || variant === "ellipse"
          ? "border-radius:50%;"
          : radius > 0
            ? `border-radius:${radius}px;`
            : "";
      const border = sw > 0 ? `border:${sw}px solid ${stroke};` : "";
      return `<div class="block block-shape" data-block-id="${idAttr}" data-type="SHAPE" style="${style};background:${fill};${border}${round}"></div>`;
    }
    case "TEXT":
    case "VARIABLE_TEXT": {
      const content =
        typeof cfg.content === "string"
          ? cfg.content
          : typeof cfg.fallback === "string"
            ? cfg.fallback
            : "";
      // No renderizar @ vacío / placeholders rotos
      const trimmed = content.trim();
      if (
        trimmed === "" ||
        trimmed === "@" ||
        trimmed === "undefined" ||
        trimmed === "null"
      ) {
        return "";
      }
      const ty = typographyStyle(cfg);
      return `<div class="block block-text" data-block-id="${idAttr}" data-type="${block.type}" style="${style};${ty}">${escapeHtml(content)}</div>`;
    }
    case "IMAGE":
    case "PHOTO": {
      const source =
        cfg.source && typeof cfg.source === "object"
          ? (cfg.source as { src?: string; url?: string })
          : {};
      const rawSrc =
        (typeof cfg.src === "string" && cfg.src) ||
        source.src ||
        source.url ||
        "";
      const asset = resolvePreviewAssetSrc(rawSrc, {
        optional: true,
        placeholder: "",
      });
      if (asset.warning) warnings.push(`${block.id}:${asset.warning}`);
      if (!asset.src) {
        return `<div class="block" data-block-id="${idAttr}" data-type="${block.type}" style="${style};background:#f1f5f9;"></div>`;
      }
      const mask = imageMaskStyle(cfg.maskShape, cfg.borderRadius);
      const fit = objectFitStyle(cfg.fit);
      return `<div class="block" data-block-id="${idAttr}" data-type="${block.type}" style="${style}"><img class="block-img" alt="" src="${escapeHtml(asset.src)}" style="${fit}${mask}" /></div>`;
    }
    default:
      return "";
  }
}

/**
 * Construye HTML aislado para captura Chromium.
 * Sin scripts, sin estilos globales de Next, texto escapado.
 */
export function buildTemplatePreviewHtml(
  document: ResolvedTemplateDocument,
  options?: { pageIndex?: number }
): PreviewHtmlBuildResult {
  const pageIndex = options?.pageIndex ?? 0;
  const warnings: string[] = [];
  const blocks = [...document.blocks]
    .filter((b) => (b.pageIndex ?? 0) === pageIndex)
    .sort((a, b) => (a.layout.zIndex ?? 0) - (b.layout.zIndex ?? 0));

  let imageCount = 0;
  for (const b of blocks) {
    if (b.type === "IMAGE" || b.type === "PHOTO" || b.type === "BACKGROUND") {
      const cfg = asConfig(b);
      if (typeof cfg.src === "string" && cfg.src) imageCount += 1;
    }
  }

  const stageBg =
    document.background?.color != null
      ? `background-color:${sanitizeCssColor(document.background.color, "#ffffff")};`
      : "";

  const bodyBlocks = blocks.map((b) => renderBlockHtml(b, warnings)).join("\n");
  const css = buildPreviewDocumentCss({
    width: document.width,
    height: document.height,
  });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />
<title>template-preview</title>
<style>
${buildPreviewFontFaceCss()}
${css}
</style>
</head>
<body>
<div id="stage" style="${stageBg}">
${bodyBlocks}
</div>
</body>
</html>`;

  return {
    html,
    warnings,
    imageCount,
    blockCount: blocks.length,
  };
}
