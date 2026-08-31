/** Render HTML/PNG del editor Template V2. */
/*
 * El puente al módulo de impresión y su contrato viven en este barril, no en el del navegador:
 * arrastran las fuentes y el emisor, que solo existen en el servidor.
 */
export * from "../design-studio-bridge";
export * from "../design-studio-contract";

/** Vista previa sin navegador: la única que funciona en el servidor de producción. */
export * from "./preview-svg";
export * from "./template-v2-preview-service";
export * from "./template-v2-preview-renderer";
export * from "./template-v2-html-builder";
export * from "./template-v2-css-builder";
export * from "./template-v2-asset-resolver";
export * from "./template-v2-font-resolver";
export * from "./template-v2-render-limits";
export * from "./template-v2-render-errors";
export * from "./template-v2-browser-manager";
export * from "./template-v2-html-escape";
export * from "./create-template-preview-example-data";
