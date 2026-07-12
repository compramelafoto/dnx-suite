/**
 * Error base para operaciones de providers.
 */
export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}

/**
 * Error cuando un provider no está configurado.
 */
export class ProviderNotConfiguredError extends ProviderError {
  constructor(provider: string) {
    super(provider, "Provider no configurado. Revisa las variables de entorno.");
    this.name = "ProviderNotConfiguredError";
  }
}
