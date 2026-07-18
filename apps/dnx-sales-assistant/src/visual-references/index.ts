export type { VisualReference } from "./domain/visual-reference.js";
export type { VisualReferenceRights } from "./domain/visual-reference-rights.js";
export type { VisualReferenceSource } from "./domain/visual-reference-source.js";
export type { VisualReferenceNiche } from "./domain/visual-reference-niche.js";
export { VISUAL_REFERENCE_NICHES, isVisualReferenceNiche } from "./domain/visual-reference-niche.js";
export { EDUCATIONAL_PURPOSES } from "./domain/educational-purpose.js";
export type { VisualReferenceProvider } from "./provider/visual-reference-provider.js";
export { LocalCuratedVisualReferenceProvider } from "./provider/local-curated-visual-reference-provider.js";
export {
  selectVisualReferences,
  DEFAULT_VISUAL_REFERENCE_LIMIT,
} from "./selection/select-visual-references.js";
export { serializePublicVisualReference } from "./serialization/serialize-public-visual-reference.js";
export { loadLocalVisualReferenceCatalog } from "./catalog/load-local-visual-reference-catalog.js";
export {
  VISUAL_REFERENCES_CATALOG_PATH,
  VISUAL_REFERENCES_ASSETS_DIR,
} from "./catalog/paths.js";
export { buildVisualReferenceReply } from "./reply/build-visual-reference-reply.js";
export { createAbstractPlaceholderPng, PLACEHOLDER_LABEL } from "./fixtures/create-abstract-placeholder-png.js";
