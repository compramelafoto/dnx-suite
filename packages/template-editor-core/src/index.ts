/**
 * Núcleo del editor Template V2 — parte isomorfa.
 *
 * Este índice lo importan también los componentes del lienzo, así que **no debe
 * arrastrar código de servidor**: `rendering` usa Playwright y `services` usa
 * Prisma, y viven en subrutas propias
 * (`@repo/template-editor-core/rendering` y `/services`).
 *
 * Geometría del lienzo, diagnósticos, catálogo de variables y presets.
 * Lo consumen tanto ComprameLaFoto como Clickatón.
 */

export * from "./align-block-to-canvas";
export * from "./align-layout-to-safe-area";
export * from "./align-selection-bounds";
export * from "./block-arrays-equivalent";
export * from "./block-display-name";
export * from "./block-style-clipboard";
export * from "./canvas-print-units";
export * from "./block-size-aspect";
export * from "./client-photo-slots";
export {
  SCHOOL_CLIENT_PHOTO_PLACEHOLDER,
  CLASS_LIST_MAX_COLUMNS,
  CLASS_LIST_SAMPLE,
  CLASS_LIST_CROWD_RATIO,
  CLASS_LIST_HEADING_SCALE_MAX,
  CLASS_LIST_HEADING_SCALE_MIN,
  CLASS_LIST_SAMPLE_GROUPS,
  CLASS_LIST_SAMPLE_TITLE,
  CLASS_LIST_SAMPLE_SHIFT,
  CLASS_LIST_SAMPLE_SCHOOL,
  CLASS_LIST_MULTI_COURSE_COLUMNS,
  formatCourseName,
  formatShiftLabel,
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
  CLASS_LIST_VARIABLE_KEY,
  DEFAULT_CLASS_LIST_OPTIONS,
  formatClassList,
  isClassListConfig,
  layoutClassList,
  parseClassListValue,
  readClassListOptions,
  serializeClassList,
  type ClassListCell,
  type ClassListLayout,
  type ClassListLine,
  type ClassListOptions,
  type ClassListStudent,
  COURSE_MOSAIC_PHOTO_ASPECT_MAX,
  COURSE_MOSAIC_PHOTO_ASPECT_MIN,
  COURSE_MOSAIC_SAMPLE,
  COURSE_MOSAIC_TILT_MAX,
  COURSE_MOSAIC_VARIABLE_KEY,
  DEFAULT_COURSE_MOSAIC_OPTIONS,
  distributeCourseMosaic,
  isCourseMosaicConfig,
  layoutCourseMosaic,
  parseCourseMosaic,
  parseCourseMosaicOwner,
  serializeCourseMosaicOwner,
  COURSE_MOSAIC_OWNER_VARIABLE_KEY,
  readCourseMosaicOptions,
  serializeCourseMosaic,
  type CourseMosaicCell,
  type CourseMosaicOptions,
  type CourseMosaicStudent,
} from "@repo/template-engine";
export * from "./clamp-block-position";
export * from "./create-default-blocks";
export * from "./huecos-sin-fondo";
export * from "./diagnostic-quick-fixes";
export * from "./editor-canvas-tool";
export * from "./editor-font-catalog";
export * from "./editor-mock-variables";
export * from "./editor-store";
export * from "./fork-template-v2-meta";
export * from "./template-v2-version-lineage";
export * from "./get-canvas-center-axes";
export * from "./get-safe-area-rect";
export * from "./layer-order";
export * from "./layout-vs-safe-area";
export * from "./load-template-v2-duplicate-graph";
export * from "./measure-text-block-bounds";
export * from "./render-core";
export * from "./resize-block-from-handle";
export * from "./resolve-template-product";
export * from "./resolve-text-brace-variables";
export * from "./revision-conflict";
export * from "./rotation-math";
export * from "./snap-drag-to-canvas";
export * from "./editor-guides";
export * from "./editor-reference-guides";
export * from "./variable-text-formats";
export * from "./template-diagnostics";
export * from "./template-engine-compat";
export * from "./template-v2-api-client";
export * from "./template-v2-api-compat";
export * from "./text-edit-bridge";
export * from "./upload-template-version-image";
export * from "./validate-save-payload";
export * from "./variable-catalog";
export * from "./variable-catalog-fotoffice";
export * from "./variable-catalog-fotorank";
export * from "./variable-catalog-product";

export * from "./presets/index";

export * from "./fit-zoom";
export * from "./blocks-at-point";
export * from "./selection-bounds";
