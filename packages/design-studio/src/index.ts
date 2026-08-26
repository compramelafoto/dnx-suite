export { emitDesign, checksumOf } from "./export/emit";
export type { EmissionFormat, EmittedFile, EmitRequest, EmitOutcome } from "./export/contract";

export {
  readDesignDocument,
  migrateDesignDocument,
  DOCUMENT_MIGRATIONS,
} from "./document/migrate";
export type { DocumentMigration } from "./document/migrate";
export { DESIGN_SCHEMA_VERSION } from "./document/schema";
export type {
  DesignDocument,
  DesignFormat,
  DesignMedium,
  DesignSide,
  DesignBlock,
  TextBlock,
  QrBlock,
  ImageBlock,
  LineBlock,
  RectBlock,
} from "./document/schema";
export { mmToPt, ptToMm, mmToPx, pxToPt, ptToPx } from "./document/units";

export type {
  VariableContract,
  VariableDeclaration,
  VariableType,
  VariableValues,
  ResolvedVariables,
  DateFormatId,
} from "./variables/contract";
export { resolveVariables, placeholdersOf } from "./variables/resolve";
export { formatDateUtc } from "./variables/dates";

export { validateForPublish } from "./validation/publish";
export type { PublishValidation } from "./validation/publish";
export {
  evaluateQrLegibility,
  MIN_MODULE_MM,
  WARN_MODULE_MM,
  MIN_MODULE_PX,
  WARN_MODULE_PX,
} from "./validation/qr";
export type { QrLegibility, QrLegibilityLevel } from "./validation/qr";

export { FONT_CATALOG, FONT_IDS, isFontId, slotFor } from "./fonts/catalog";
export type { FontId, FontSlot, FontDefinition } from "./fonts/catalog";

export { RENDERER_VERSION } from "./render/version";
export type { ResourceResolver } from "./render/resources";
export { renderSvgPages } from "./render/svg";

export type { Result } from "./result";
export type { TextMeasurer, LayoutPlan, LayoutPage, LayoutItem } from "./layout/plan";
