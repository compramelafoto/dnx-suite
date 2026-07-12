import type { Provider, ProviderName } from "../../types/provider.js";
import { ProviderNotConfiguredError } from "../../utils/errors.js";
import { buildProviderHealthReport } from "./provider-health.js";
import {
  ProviderNameMismatchError,
  ProviderNotRegisteredError,
  type ProviderHealthReport,
  type ProviderRegistrySnapshot,
} from "./provider-registry-types.js";

export class ProviderRegistry {
  private readonly providers = new Map<ProviderName, Provider>();

  registerProvider(name: ProviderName, provider: Provider): this {
    if (provider.name !== name) {
      throw new ProviderNameMismatchError(name, provider.name);
    }

    this.providers.set(name, provider);
    return this;
  }

  getProvider(name: ProviderName): Provider | undefined {
    return this.providers.get(name);
  }

  hasProvider(name: ProviderName): boolean {
    return this.providers.has(name);
  }

  listProviders(): ProviderName[] {
    return [...this.providers.keys()].sort();
  }

  isConfigured(name: ProviderName): boolean {
    const provider = this.providers.get(name);
    if (!provider) {
      return false;
    }

    return provider.isConfigured();
  }

  assertConfigured(name: ProviderName): void {
    if (!this.hasProvider(name)) {
      throw new ProviderNotRegisteredError(name);
    }

    if (!this.isConfigured(name)) {
      throw new ProviderNotConfiguredError(name);
    }
  }

  getHealth(): ProviderHealthReport {
    return buildProviderHealthReport(this);
  }

  snapshot(): ProviderRegistrySnapshot {
    const names = this.listProviders();
    const configured = names.filter((name) => this.isConfigured(name));
    const unconfigured = names.filter((name) => !this.isConfigured(name));

    return { names, configured, unconfigured };
  }
}
