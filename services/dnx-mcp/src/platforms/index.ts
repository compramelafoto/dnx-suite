export {
  getPlatform,
  getPlatformOrThrow,
  listPlatforms,
  validatePlatform,
  registerPlatform,
  PlatformNotFoundError,
  PlatformRegistrationError,
} from "./registry.js";

export { validatePlatformDefinition } from "./validators.js";

export {
  platformDefinitionSchema,
  toPlatformContext,
  type PlatformDefinition,
  type PlatformId,
  type PlatformContext,
  type PlatformValidationResult,
  type HealthEndpoint,
  type SmokeTest,
  type ReleasePolicy,
  type RollbackPolicy,
  type MaintenanceMode,
  type FeatureFlag,
} from "./types.js";

export { comprameLaFotoPlatform } from "./platforms/compramelafoto.js";
export { fotoOfficePlatform } from "./platforms/fotooffice.js";
export { fotorankPlatform } from "./platforms/fotorank.js";
export { camOfDutyPlatform } from "./platforms/camofduty.js";
export { cuantoCobroPlatform } from "./platforms/cuantocobro.js";
