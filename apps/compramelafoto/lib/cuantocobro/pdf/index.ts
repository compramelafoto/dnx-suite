export type { EmbedPdfFontsOptions } from "./fonts";
export { embedPdfStandardFonts } from "./fonts";

export { buildPdfDocumentColors, parseHexColor } from "./colors";

export {
  CC_PDF_ACCENT_FALLBACK,
  collectPdfLogoCandidates,
  normalizePdfLogoCandidateUrl,
  resolvePdfPhotographerAccentHex,
} from "./branding";

export {
  commercialInitialsFromLabel,
  resolveLineHeight,
  truncateTextToWidth,
  wrapTextByWidth,
} from "./text";

export {
  createPdfDocumentContext,
  finalizePdfPages,
  savePdfDocument,
} from "./context";
export type { CreatePdfDocumentContextOptions } from "./context";

export {
  resolvePdfLogo,
  scaleLogoToMaxBox,
} from "./logo";
export type { ResolvePdfLogoOptions } from "./logo";

export {
  addPage,
  drawAmount,
  drawBlockHeading,
  drawCard,
  drawCheckItem,
  drawDivider,
  drawFooter,
  drawFootersOnAllPages,
  drawInvestmentHero,
  drawLogoOrFallback,
  drawMetaColumn,
  drawMetaText,
  drawPaymentCard,
  drawPill,
  drawSectionTitle,
  drawText,
  drawTitle,
  drawWrappedText,
  ensureSpace,
  measureCheckItemHeight,
  measureInvestmentHeroHeight,
  measurePaymentCardHeight,
  moveY,
  PDF_CHECK_MARKER_SIZE,
  PDF_FOOTER_RESERVE_PT,
  PDF_LOGO_MAX_HEIGHT,
  PDF_LOGO_MAX_WIDTH,
} from "./layout";
export type {
  PdfCardOptions,
  PdfCheckItemOptions,
  PdfDividerOptions,
  PdfFooterOptions,
  PdfInvestmentHeroOptions,
  PdfPaymentCardContent,
} from "./layout";

export type {
  PdfDocumentColors,
  PdfDocumentContext,
  PdfDocumentFonts,
  PdfDrawTextOptions,
  PdfDrawWrappedTextOptions,
  PdfLogoEmbedResult,
  PdfPageSize,
  PdfTextAlign,
} from "./types";
export { PDF_A4_PORTRAIT } from "./types";
