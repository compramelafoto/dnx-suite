/**
 * Adapter CLF → @repo/template-engine-renderer (browser Playwright compartido).
 * Mapea TemplateRenderError → TemplatePreviewError.
 */
import {
  getTemplatePreviewBrowser as getBrowserShared,
  closeTemplatePreviewBrowser as closeBrowserShared,
  captureTemplatePreviewPng as captureShared,
  __previewActiveRendersForTests,
  type PreviewCaptureInput,
  type PreviewCaptureResult,
} from "@repo/template-engine-renderer";
import { mapTemplateRenderError } from "@/lib/template-v2/rendering/template-v2-render-errors";

export type { PreviewCaptureInput, PreviewCaptureResult };
export { __previewActiveRendersForTests };

export async function getTemplatePreviewBrowser() {
  try {
    return await getBrowserShared();
  } catch (err) {
    const mapped = mapTemplateRenderError(err);
    if (mapped) throw mapped;
    throw err;
  }
}

export async function closeTemplatePreviewBrowser() {
  return closeBrowserShared();
}

export async function captureTemplatePreviewPng(
  input: PreviewCaptureInput
): Promise<PreviewCaptureResult> {
  try {
    return await captureShared(input);
  } catch (err) {
    const mapped = mapTemplateRenderError(err);
    if (mapped) throw mapped;
    throw err;
  }
}
