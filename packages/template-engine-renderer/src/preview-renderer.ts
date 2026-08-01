import type { ResolvedTemplateDocument } from "@repo/template-engine";
import { buildTemplatePreviewHtml } from "./html-builder";
import { captureTemplatePreviewPng } from "./browser-manager";
import {
  TEMPLATE_V2_PREVIEW_LIMITS,
  clampPreviewScale,
} from "./render-limits";
import { previewLimitExceeded } from "./render-errors";
import { countImageSources } from "./asset-resolver";

export type TemplatePreviewRenderOptions = {
  pageIndex?: number;
  scale?: number;
};

export type TemplatePreviewRenderResult = {
  png: Buffer;
  width: number;
  height: number;
  mimeType: "image/png";
  durationMs: number;
  blockCount: number;
  imageCount: number;
  warnings: string[];
};

export async function renderTemplatePreviewPng(
  document: ResolvedTemplateDocument,
  options?: TemplatePreviewRenderOptions
): Promise<TemplatePreviewRenderResult> {
  if (document.blocks.length > TEMPLATE_V2_PREVIEW_LIMITS.maxBlocks) {
    throw previewLimitExceeded(
      `Máximo ${TEMPLATE_V2_PREVIEW_LIMITS.maxBlocks} bloques en preview`
    );
  }

  const imageCount = countImageSources(
    document.blocks.map((b) => ({
      type: b.type,
      config: (b.config ?? {}) as Record<string, unknown>,
    }))
  );
  if (imageCount > TEMPLATE_V2_PREVIEW_LIMITS.maxImages) {
    throw previewLimitExceeded(
      `Máximo ${TEMPLATE_V2_PREVIEW_LIMITS.maxImages} imágenes en preview`
    );
  }

  if (
    document.width > TEMPLATE_V2_PREVIEW_LIMITS.maxWidth ||
    document.height > TEMPLATE_V2_PREVIEW_LIMITS.maxHeight
  ) {
    throw previewLimitExceeded(
      `Canvas supera ${TEMPLATE_V2_PREVIEW_LIMITS.maxWidth}×${TEMPLATE_V2_PREVIEW_LIMITS.maxHeight}`
    );
  }

  const scale = clampPreviewScale(options?.scale);
  const built = buildTemplatePreviewHtml(document, {
    pageIndex: options?.pageIndex ?? 0,
  });

  const capture = await captureTemplatePreviewPng({
    html: built.html,
    width: document.width,
    height: document.height,
    scale,
  });

  return {
    png: capture.png,
    width: capture.width,
    height: capture.height,
    mimeType: "image/png",
    durationMs: capture.durationMs,
    blockCount: built.blockCount,
    imageCount: built.imageCount,
    warnings: built.warnings,
  };
}
