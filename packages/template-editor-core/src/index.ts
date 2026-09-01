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
export * from "./clamp-block-position";
export * from "./create-default-blocks";
export * from "./diagnostic-quick-fixes";
export * from "./editor-canvas-tool";
export * from "./editor-font-catalog";
export * from "./editor-mock-variables";
export * from "./editor-store";
export * from "./fork-template-v2-meta";
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
export * from "./template-diagnostics";
export * from "./template-engine-compat";
export * from "./template-v2-api-client";
export * from "./template-v2-api-compat";
export * from "./text-edit-bridge";
export * from "./upload-template-version-image";
export * from "./validate-save-payload";
export * from "./variable-catalog";
export * from "./variable-catalog-fotoffice";
export * from "./variable-catalog-product";

export * from "./presets/index";

export * from "./fit-zoom";
export * from "./blocks-at-point";
