import type { ProviderRegistry } from "./provider-registry.js";
import type { ProviderHealthReport, ProviderHealthStatus } from "./provider-registry-types.js";

export function buildProviderHealthReport(registry: ProviderRegistry): ProviderHealthReport {
  const names = registry.listProviders();

  const providers = names.map((name) => {
    const configured = registry.isConfigured(name);
    const status: ProviderHealthStatus = configured ? "healthy" : "unconfigured";

    return {
      name,
      registered: true as const,
      configured,
      status,
    };
  });

  const configuredCount = providers.filter((entry) => entry.configured).length;

  return {
    providers,
    configuredCount,
    totalCount: providers.length,
    checkedAt: new Date().toISOString(),
  };
}
