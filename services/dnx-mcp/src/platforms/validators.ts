import {
  platformDefinitionSchema,
  type PlatformDefinition,
  type PlatformValidationResult,
} from "./types.js";

export function validatePlatformDefinition(platform: PlatformDefinition): PlatformValidationResult {
  const result = platformDefinitionSchema.safeParse(platform);

  if (result.success) {
    const semanticErrors = collectSemanticErrors(result.data);
    return {
      valid: semanticErrors.length === 0,
      platformId: platform.id,
      errors: semanticErrors,
    };
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
  );

  return {
    valid: false,
    platformId: platform.id,
    errors,
  };
}

function collectSemanticErrors(platform: PlatformDefinition): string[] {
  const errors: string[] = [];

  const productionSet = new Set(platform.domains.production);
  const previewSet = new Set(platform.domains.preview);

  for (const domain of platform.domains.production) {
    if (previewSet.has(domain) && productionSet.size > 1) {
      errors.push(`Dominio "${domain}" aparece en production y preview`);
    }
  }

  if (platform.releasePolicy.requireStagingValidation && platform.smokeTests.length === 0) {
    errors.push("releasePolicy.requireStagingValidation requiere al menos un smokeTest");
  }

  if (platform.rollbackPolicy.enabled && !platform.rollbackPolicy.requireConfirmation) {
    errors.push("rollbackPolicy habilitado debe requerir confirmación");
  }

  if (platform.maintenanceMode.enabled && !platform.maintenanceMode.message) {
    errors.push("maintenanceMode habilitado requiere message");
  }

  const flagKeys = new Set<string>();
  for (const flag of platform.featureFlags) {
    if (flagKeys.has(flag.key)) {
      errors.push(`featureFlag duplicado: ${flag.key}`);
    }
    flagKeys.add(flag.key);
  }

  return errors;
}
