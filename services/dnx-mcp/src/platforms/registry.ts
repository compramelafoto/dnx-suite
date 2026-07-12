import { camOfDutyPlatform } from "./platforms/camofduty.js";
import { comprameLaFotoPlatform } from "./platforms/compramelafoto.js";
import { cuantoCobroPlatform } from "./platforms/cuantocobro.js";
import { fotoOfficePlatform } from "./platforms/fotooffice.js";
import { fotorankPlatform } from "./platforms/fotorank.js";
import type { PlatformDefinition, PlatformValidationResult } from "./types.js";
import { validatePlatformDefinition } from "./validators.js";

const platformRegistry = new Map<string, PlatformDefinition>([
  [comprameLaFotoPlatform.id, comprameLaFotoPlatform],
  [fotoOfficePlatform.id, fotoOfficePlatform],
  [fotorankPlatform.id, fotorankPlatform],
  [camOfDutyPlatform.id, camOfDutyPlatform],
  [cuantoCobroPlatform.id, cuantoCobroPlatform],
]);

export function getPlatform(id: string): PlatformDefinition | undefined {
  return platformRegistry.get(id);
}

export function getPlatformOrThrow(id: string): PlatformDefinition {
  const platform = getPlatform(id);
  if (!platform) {
    throw new PlatformNotFoundError(id);
  }
  return platform;
}

export function listPlatforms(): PlatformDefinition[] {
  return [...platformRegistry.values()];
}

export function validatePlatform(input: string | PlatformDefinition): PlatformValidationResult {
  const platform = typeof input === "string" ? getPlatform(input) : input;

  if (!platform) {
    return {
      valid: false,
      platformId: typeof input === "string" ? input : input.id,
      errors: [`Plataforma no registrada: ${typeof input === "string" ? input : input.id}`],
    };
  }

  return validatePlatformDefinition(platform);
}

export function registerPlatform(platform: PlatformDefinition): void {
  const validation = validatePlatformDefinition(platform);
  if (!validation.valid) {
    throw new PlatformRegistrationError(platform.id, validation.errors);
  }
  platformRegistry.set(platform.id, platform);
}

export class PlatformNotFoundError extends Error {
  constructor(id: string) {
    super(`Plataforma no encontrada: ${id}`);
    this.name = "PlatformNotFoundError";
  }
}

export class PlatformRegistrationError extends Error {
  constructor(
    public readonly platformId: string,
    public readonly errors: string[],
  ) {
    super(`No se pudo registrar plataforma "${platformId}": ${errors.join("; ")}`);
    this.name = "PlatformRegistrationError";
  }
}
