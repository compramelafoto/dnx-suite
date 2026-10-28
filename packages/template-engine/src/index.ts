/**
 * @repo/template-engine — núcleo compartido de plantillas DNX Suite.
 * Sin Next.js, Prisma, React, Sharp ni R2.
 */

export {
  TEMPLATE_SCHEMA_VERSION,
  SUPPORTED_TEMPLATE_SCHEMA_VERSIONS,
  KNOWN_FORMATTERS,
  DANGEROUS_PATH_SEGMENTS,
} from "./core/constants";
export type { KnownFormatter } from "./core/constants";

export {
  resolveTemplateDocument,
  type ResolveTemplateDocumentInput,
  type TemplateResolutionResult,
  type TemplateResolutionWarning,
  type TemplateResolutionError,
} from "./core/resolve-document";

export {
  TEMPLATE_BLOCK_TYPES,
  templateBlockLayoutSchema,
  templateTypographySchema,
  templateBlockSchema,
  templateVariableBindingSchema,
  textBlockConfigSchema,
  variableTextBlockConfigSchema,
  imageBlockConfigSchema,
  shapeBlockConfigSchema,
  backgroundBlockConfigSchema,
  type TemplateBlockType,
  type TemplateBlock,
  type TemplateBlockLayout,
  type TemplateTypography,
  type TemplateVariableBinding,
} from "./schema/blocks";

export {
  templateDocumentSchema,
  templateBackgroundSchema,
  templatePrintMetaSchema,
  type TemplateDocument,
  type TemplateBackground,
  type TemplatePrintMeta,
  type ResolvedTemplateDocument,
} from "./schema/document";

export {
  parseTemplateDocument,
  createEmptyTemplateDocument,
  type ParseTemplateDocumentResult,
} from "./schema/parse";

export {
  parseTemplateBinding,
  normalizeTemplateBinding,
  serializeTemplateBinding,
  isTemplateBinding,
  isDangerousPath,
  isValidVariablePath,
  normalizeBraceSlug,
  braceSnippetForPath,
  BRACE_TOKEN_RE,
  DOUBLE_BRACE_TOKEN_RE,
  type TemplateBindingRef,
  type ParseBindingResult,
  type NormalizeBindingOptions,
} from "./bindings";

export {
  createTemplateVariableRegistry,
  registerVariableDefinitions,
  getVariableDefinition,
  listVariableDefinitions,
  resolveTemplateVariable,
  type TemplateVariableRegistry,
  type CreateRegistryOptions,
} from "./variables/registry";

export type {
  TemplateVariableDefinition,
  TemplateVariablePlugin,
  TemplateVariableValueType,
  TemplateVariableUsableIn,
  ResolveVariableResult,
  ResolveVariableStatus,
} from "./variables/types";

export { safeGetByPath, isEmptyValue } from "./variables/resolve-path";
export { applyFormatter, isKnownFormatter } from "./variables/formatters";

export {
  fotofficeTemplateVariablesPlugin,
  FOTOFFICE_TEMPLATE_VARIABLE_DEFINITIONS,
} from "./plugins/fotoffice";

export {
  fotorankTemplateVariablesPlugin,
  FOTORANK_TEMPLATE_VARIABLE_DEFINITIONS,
} from "./plugins/fotorank";

export {
  schoolTemplateVariablesPlugin,
  SCHOOL_TEMPLATE_ALIASES,
  SCHOOL_TEMPLATE_VARIABLE_DEFINITIONS,
  SCHOOL_TEMPLATE_EXAMPLE_DATA,
  SCHOOL_CLIENT_PHOTO_PLACEHOLDER,
  SCHOOL_GROUP_PHOTO_KEY,
  SCHOOL_INDIVIDUAL_PHOTO_KEY,
  SCHOOL_TEACHER_PHOTO_KEY,
  SCHOOL_FRIENDS_PHOTO_KEY,
  SCHOOL_EXTRA_PHOTO_KEY,
  SCHOOL_NAMED_PHOTO_KEYS,
  CLASS_LIST_VARIABLE_KEY,
  CLASS_LIST_MAX_COLUMNS,
  CLASS_LIST_SAMPLE,
  CLASS_LIST_CROWD_RATIO,
  CLASS_LIST_HEADING_SCALE_MAX,
  CLASS_LIST_HEADING_SCALE_MIN,
  CLASS_LIST_HEADING_FONT_SIZE_MAX,
  classListHeadingScale,
  CLASS_LIST_SAMPLE_GROUPS,
  CLASS_LIST_SAMPLE_TITLE,
  CLASS_LIST_SAMPLE_SHIFT,
  CLASS_LIST_SAMPLE_SCHOOL,
  CLASS_LIST_MULTI_COURSE_COLUMNS,
  formatCourseName,
  formatShiftLabel,
  COURSE_MOSAIC_VARIABLE_KEY,
  COURSE_MOSAIC_SAMPLE,
  COURSE_MOSAIC_CHAR_WIDTH,
  COURSE_MOSAIC_NAME_MIN_SCALE,
  COURSE_MOSAIC_PHOTO_ASPECT_MAX,
  COURSE_MOSAIC_PHOTO_ASPECT_MIN,
  COURSE_MOSAIC_TILT_MAX,
  DEFAULT_COURSE_MOSAIC_OPTIONS,
  formatMosaicName,
  isCourseMosaicConfig,
  layoutCourseMosaic,
  parseCourseMosaic,
  readCourseMosaicOptions,
  serializeCourseMosaic,
  sortCourseMosaic,
  splitCourseMosaicChain,
  distributeCourseMosaic,
  COURSE_MOSAIC_OWNER_VARIABLE_KEY,
  parseCourseMosaicOwner,
  serializeCourseMosaicOwner,
  type CourseMosaicCell,
  type CourseMosaicCrop,
  type CourseMosaicFrame,
  type CourseMosaicNamePosition,
  type CourseMosaicOptions,
  type CourseMosaicRect,
  type CourseMosaicStudent,
  formatClassListHeading,
  classListCrowdMessage,
  classListCrowdWarning,
  countClassListStudents,
  formatClassListGroups,
  layoutClassListBlock,
  layoutClassListSections,
  parseClassListGroups,
  serializeClassListGroups,
  type ClassListGroup,
  type ClassListSection,
  type ClassListSectionCell,
  type ClassListSectionsLayout,
  DEFAULT_CLASS_LIST_OPTIONS,
  formatClassList,
  isClassListConfig,
  layoutClassList,
  parseClassListValue,
  readClassListOptions,
  readClassListHeadingStyle,
  resolveClassListHeadingStyle,
  type ClassListHeadingStyle,
  type ClassListTextStyle,
  type ClassListTextTransform,
  serializeClassList,
  type ClassListCell,
  type ClassListLayout,
  type ClassListLine,
  type ClassListOptions,
  type ClassListStudent,
} from "./plugins/school";

export {
  clickatonTemplateVariablesPlugin,
  CLICKATON_TEMPLATE_ALIASES,
  CLICKATON_TEMPLATE_VARIABLE_DEFINITIONS,
  CLICKATON_TEMPLATE_EXAMPLE_DATA,
  CLICKATON_FIXTURE_PHOTO_DATA_URL,
  createClickatonTemplateExampleData,
  normalizeInstagramHandle,
  CLICKATON_DEFAULT_TIMEZONE,
  formatDateShort,
  formatDateLong,
  formatDateLongUppercase,
  formatDateDayMonthUppercase,
  formatDateWithTime,
  formatParticipantNumber,
} from "./plugins/clickaton";
export type { NormalizeInstagramResult } from "./plugins/clickaton";

export {
  sponsorTemplateVariablesPlugin,
  SPONSOR_TEMPLATE_ALIASES,
  SPONSOR_TEMPLATE_VARIABLE_DEFINITIONS,
} from "./plugins/sponsor";

export {
  fromLegacyTemplateV2,
  toLegacyTemplateV2,
  type LegacyTemplateV2Payload,
  type LegacyTemplateV2BlockType,
  type BridgeWarning,
  type FromLegacyResult,
  type ToLegacyResult,
} from "./bridge";

export type { TemplateRepository } from "./contracts/repository";
export type {
  TemplateAssetResolver,
  TemplateAssetReference,
  ResolvedTemplateAsset,
} from "./contracts/assets";
export type {
  TemplateRenderer,
  TemplateRenderResult,
  TemplateRenderFormat,
} from "./contracts/renderer";
