export {
  TEMPLATE_V2_PREVIEW_LIMITS,
  assertPreviewCanvasLimits,
  clampPreviewScale,
} from "./render-limits";

export {
  TemplateRenderError,
  previewInvalid,
  previewLimitExceeded,
  previewAssetFailed,
  previewTimeout,
  previewUnavailable,
  previewBusy,
} from "./render-errors";
export type { TemplateRenderErrorCode } from "./render-errors";

/** Alias histórico usado por ComprameLaFoto. */
export { TemplateRenderError as TemplatePreviewError } from "./render-errors";

export {
  escapeHtml,
  escapeCssUrl,
  sanitizeCssColor,
} from "./html-escape";

export {
  TEMPLATE_V2_PREVIEW_ALLOWED_FONTS,
  resolvePreviewFontFamily,
  buildPreviewFontFaceCss,
} from "./font-resolver";
export type { FontResolveResult } from "./font-resolver";

export {
  buildPreviewDocumentCss,
  layoutStyle,
  typographyStyle,
  objectFitStyle,
  imageMaskStyle,
  backgroundImageStyle,
} from "./css-builder";

export {
  assertPreviewAssetUrlShape,
  resolvePreviewAssetSrc,
  countImageSources,
} from "./asset-resolver";
export type { ResolvedPreviewAsset } from "./asset-resolver";

export { buildTemplatePreviewHtml } from "./html-builder";
export type { PreviewHtmlBuildResult } from "./html-builder";

export {
  getTemplatePreviewBrowser,
  closeTemplatePreviewBrowser,
  captureTemplatePreviewPng,
  __previewActiveRendersForTests,
} from "./browser-manager";
export type {
  PreviewCaptureInput,
  PreviewCaptureResult,
} from "./browser-manager";

export { renderTemplatePreviewPng } from "./preview-renderer";
export type {
  TemplatePreviewRenderOptions,
  TemplatePreviewRenderResult,
} from "./preview-renderer";
