export { RENDERER_VERSION } from "./types";
export type {
  CompositionBlock,
  CompositionPlatform,
  CompositionTemplate,
  CompositionVariableMap,
  CropBox,
  CropParams,
  ProfilePhotoValidation,
  RenderAssetInputs,
  RenderOutput,
  RenderRequest,
} from "./types";

export {
  assertInstagramHandle,
  normalizeInstagramHandle,
  type InstagramNormalized,
} from "./instagram";

export {
  buildProfilePhotoDerivatives,
  DEFAULT_PROFILE_PHOTO_LIMITS,
  extractSquareCrop,
  resolveCropParams,
  validateProfilePhotoBuffer,
} from "./crop";

export { collectMissingVariables, interpolateTemplate } from "./variables";
export { hashRenderInputs, renderComposition } from "./render";
export {
  CLICKATON_WELCOME_STORY_V1,
  CLICKATON_CREDENTIAL_PREVIEW_V1,
  getCompositionTemplate,
  listCompositionTemplates,
} from "./templates/index";
