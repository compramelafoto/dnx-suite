import { ProviderError } from "../../utils/errors.js";

export class PostgresError extends ProviderError {
  constructor(message: string, cause?: unknown) {
    super("postgres", message, cause);
    this.name = "PostgresError";
  }
}

export class PostgresNotConfiguredError extends PostgresError {
  constructor(message = "Provider PostgreSQL no configurado") {
    super(message);
    this.name = "PostgresNotConfiguredError";
  }
}

export class PostgresConnectionError extends PostgresError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "PostgresConnectionError";
  }
}

export class PostgresQueryError extends PostgresError {
  constructor(
    message: string,
    public readonly queryLabel: string,
    cause?: unknown,
  ) {
    super(message, cause);
    this.name = "PostgresQueryError";
  }
}

export class PostgresQueryTimeoutError extends PostgresQueryError {
  constructor(queryLabel: string, timeoutMs: number) {
    super(`Query "${queryLabel}" excedió el timeout de ${String(timeoutMs)}ms`, queryLabel);
    this.name = "PostgresQueryTimeoutError";
  }
}

export class PostgresForbiddenQueryError extends PostgresError {
  constructor(reason: string) {
    super(`Query no permitida (solo lectura): ${reason}`);
    this.name = "PostgresForbiddenQueryError";
  }
}
