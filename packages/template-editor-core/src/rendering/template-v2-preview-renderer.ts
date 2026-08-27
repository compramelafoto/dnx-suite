/**
 * Adapter CLF → @repo/template-engine-renderer (único renderer real).
 * Mapea TemplateRenderError → TemplatePreviewError para compat HTTP/tests.
 */
import {
  renderTemplatePreviewPng as renderShared,
  type TemplatePreviewRenderOptions,
  type TemplatePreviewRenderResult,
} from "@repo/template-engine-renderer";
import { mapTemplateRenderError } from "../rendering/template-v2-render-errors";

export type { TemplatePreviewRenderOptions, TemplatePreviewRenderResult };

export async function renderTemplatePreviewPng(
  document: Parameters<typeof renderShared>[0],
  options?: TemplatePreviewRenderOptions
): Promise<TemplatePreviewRenderResult> {
  try {
    return await renderShared(document, options);
  } catch (err) {
    const mapped = mapTemplateRenderError(err);
    if (mapped) throw mapped;
    throw err;
  }
}
