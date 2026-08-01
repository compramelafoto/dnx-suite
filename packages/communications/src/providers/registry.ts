import { CommunicationError } from "../shared/errors";
import type { CommunicationChannel } from "../shared/channels";
import type {
  CommunicationProvider,
  ProviderChannelKey,
  RegisterProviderOptions,
} from "./types";

/**
 * Registry de providers — instancia aislable para tests.
 *
 * Comportamiento:
 * - canal inexistente → getProvider lanza PROVIDER_NOT_REGISTERED
 * - registro con canal ≠ provider.channel → PROVIDER_MISMATCH
 * - segundo registro sin replace → PROVIDER_ALREADY_REGISTERED
 * - replace: true → reemplazo explícito
 */
export class CommunicationProviderRegistry {
  private readonly providers = new Map<ProviderChannelKey, CommunicationProvider>();

  registerProvider(
    channel: ProviderChannelKey,
    provider: CommunicationProvider,
    options: RegisterProviderOptions = {},
  ): void {
    if (!provider?.name?.trim()) {
      throw new CommunicationError(
        "INVALID_REQUEST",
        "El provider debe declarar un name no vacío.",
      );
    }

    if (provider.channel !== channel) {
      throw new CommunicationError(
        "PROVIDER_MISMATCH",
        `Provider "${provider.name}" declara canal "${provider.channel}" pero se registró como "${channel}".`,
        {
          expected: channel,
          actual: provider.channel,
          providerName: provider.name,
        },
      );
    }

    const existing = this.providers.get(channel);
    if (existing && !options.replace) {
      throw new CommunicationError(
        "PROVIDER_ALREADY_REGISTERED",
        `Ya hay un provider registrado para "${channel}" ("${existing.name}"). Usá { replace: true } para reemplazarlo.`,
        { channel, existingProvider: existing.name, incomingProvider: provider.name },
      );
    }

    this.providers.set(channel, provider);
  }

  getProvider(channel: ProviderChannelKey): CommunicationProvider {
    const provider = this.providers.get(channel);
    if (!provider) {
      throw new CommunicationError(
        "PROVIDER_NOT_REGISTERED",
        `No hay provider registrado para el canal "${channel}".`,
        { channel },
      );
    }
    return provider;
  }

  tryGetProvider(channel: ProviderChannelKey): CommunicationProvider | undefined {
    return this.providers.get(channel);
  }

  hasProvider(channel: ProviderChannelKey): boolean {
    return this.providers.has(channel);
  }

  removeProvider(channel: ProviderChannelKey): boolean {
    return this.providers.delete(channel);
  }

  clearProviders(): void {
    this.providers.clear();
  }

  listProviders(): ReadonlyArray<{
    channel: CommunicationChannel;
    name: string;
  }> {
    return [...this.providers.entries()].map(([channel, provider]) => ({
      channel,
      name: provider.name,
    }));
  }
}

/** Factory para tests y fachadas aisladas. */
export function createProviderRegistry(): CommunicationProviderRegistry {
  return new CommunicationProviderRegistry();
}
