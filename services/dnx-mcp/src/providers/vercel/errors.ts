import { ProviderError } from "../../utils/errors.js";

export class VercelError extends ProviderError {
  constructor(message: string, cause?: unknown) {
    super("vercel", message, cause);
    this.name = "VercelError";
  }
}

export class VercelAuthError extends VercelError {
  constructor(message = "Autenticación inválida o token sin permisos") {
    super(message);
    this.name = "VercelAuthError";
  }
}

export class VercelNotFoundError extends VercelError {
  constructor(resource: string, identifier: string) {
    super(`${resource} no encontrado: ${identifier}`);
    this.name = "VercelNotFoundError";
  }
}

export class VercelRateLimitError extends VercelError {
  constructor(
    public readonly retryAfterMs: number,
    message = "Rate limit de Vercel excedido",
  ) {
    super(message);
    this.name = "VercelRateLimitError";
  }
}

export class VercelApiError extends VercelError {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "VercelApiError";
  }
}

export class VercelValidationError extends VercelError {
  constructor(message: string) {
    super(message);
    this.name = "VercelValidationError";
  }
}

export class VercelDeploymentTimeoutError extends VercelError {
  constructor(deploymentId: string, timeoutMs: number) {
    super(`Deployment ${deploymentId} no alcanzó estado terminal en ${String(timeoutMs)}ms`);
    this.name = "VercelDeploymentTimeoutError";
  }
}
