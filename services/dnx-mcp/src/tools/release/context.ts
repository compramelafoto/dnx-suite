import { ReleaseOrchestrator } from "../../orchestrators/release/index.js";
import { getPlatformOrThrow, type PlatformDefinition } from "../../platforms/index.js";
import {
  createDefaultProviderRegistry,
  type ProviderRegistry,
} from "../../providers/registry/index.js";

let defaultRegistry: ProviderRegistry | undefined;
let defaultOrchestrator: ReleaseOrchestrator | undefined;

export function getProviderRegistry(registry?: ProviderRegistry): ProviderRegistry {
  if (registry) {
    return registry;
  }
  defaultRegistry ??= createDefaultProviderRegistry();
  return defaultRegistry;
}

export function getReleaseOrchestrator(
  options: {
    registry?: ProviderRegistry;
    orchestrator?: ReleaseOrchestrator;
  } = {},
): ReleaseOrchestrator {
  if (options.orchestrator) {
    return options.orchestrator;
  }

  defaultOrchestrator ??= new ReleaseOrchestrator({
    providerRegistry: getProviderRegistry(options.registry),
  });

  return defaultOrchestrator;
}

export function resolvePlatform(platformId: string): PlatformDefinition {
  return getPlatformOrThrow(platformId);
}

/** Reinicia singletons — solo para tests. */
export function resetReleaseToolContext(): void {
  defaultRegistry = undefined;
  defaultOrchestrator = undefined;
}
