import { ProviderError } from "../../utils/errors.js";

export class CloudflareError extends ProviderError {
  constructor(message: string, cause?: unknown) {
    super("cloudflare", message, cause);
    this.name = "CloudflareError";
  }
}

export class CloudflareAuthError extends CloudflareError {
  constructor(message = "Autenticación inválida o token sin permisos para Cloudflare") {
    super(message);
    this.name = "CloudflareAuthError";
  }
}

export class CloudflareNotFoundError extends CloudflareError {
  constructor(resource: string, identifier: string) {
    super(`${resource} no encontrado: ${identifier}`);
    this.name = "CloudflareNotFoundError";
  }
}

export class CloudflareRateLimitError extends CloudflareError {
  constructor(
    public readonly retryAfterMs: number,
    message = "Rate limit de Cloudflare excedido",
  ) {
    super(message);
    this.name = "CloudflareRateLimitError";
  }
}

export class CloudflareApiError extends CloudflareError {
  constructor(
    public readonly status: number,
    public readonly code: number | string | undefined,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "CloudflareApiError";
  }
}

export class CloudflareValidationError extends CloudflareError {
  constructor(message: string) {
    super(message);
    this.name = "CloudflareValidationError";
  }
}

export class CloudflareGuardError extends CloudflareError {
  constructor(message: string) {
    super(message);
    this.name = "CloudflareGuardError";
  }
}

export class CloudflareConfirmationRequiredError extends CloudflareError {
  constructor(action: string) {
    super(
      `Confirmación requerida para "${action}". Usa confirm: true y dryRun: false para ejecutar.`,
    );
    this.name = "CloudflareConfirmationRequiredError";
  }
}

export class CloudflareR2ObjectCredentialsError extends CloudflareError {
  constructor(
    message = "Operaciones de objetos R2 requieren R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY (API S3-compatible de Cloudflare)",
  ) {
    super(message);
    this.name = "CloudflareR2ObjectCredentialsError";
  }
}
