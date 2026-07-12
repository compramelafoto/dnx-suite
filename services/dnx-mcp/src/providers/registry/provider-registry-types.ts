import type { Provider, ProviderName } from "../../types/provider.js";
import { ProviderError } from "../../utils/errors.js";

export class ProviderNotRegisteredError extends ProviderError {
  constructor(name: string) {
    super(name, `Provider "${name}" no registrado en el registry`);
    this.name = "ProviderNotRegisteredError";
  }
}

export class ProviderNameMismatchError extends ProviderError {
  constructor(expected: string, actual: string) {
    super(expected, `El provider registrado como "${expected}" tiene name="${actual}"`);
    this.name = "ProviderNameMismatchError";
  }
}

export type ProviderHealthStatus = "healthy" | "unconfigured";

export interface ProviderHealthEntry {
  name: ProviderName;
  registered: true;
  configured: boolean;
  status: ProviderHealthStatus;
}

export interface ProviderHealthReport {
  providers: ProviderHealthEntry[];
  configuredCount: number;
  totalCount: number;
  checkedAt: string;
}

export interface DefaultProviderRegistryConfig {
  /** Reemplaza instancias por defecto antes del registro. */
  providers?: Partial<Record<ProviderName, Provider>>;
}

export interface ProviderRegistrySnapshot {
  names: ProviderName[];
  configured: ProviderName[];
  unconfigured: ProviderName[];
}
