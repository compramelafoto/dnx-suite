import { ProviderError } from "../../utils/errors.js";

export class PrismaError extends ProviderError {
  constructor(message: string, cause?: unknown) {
    super("prisma", message, cause);
    this.name = "PrismaError";
  }
}

export class PrismaNotConfiguredError extends PrismaError {
  constructor(message = "Provider Prisma no configurado") {
    super(message);
    this.name = "PrismaNotConfiguredError";
  }
}

export class PrismaSchemaNotFoundError extends PrismaError {
  constructor(path: string) {
    super(`Schema Prisma no encontrado: ${path}`);
    this.name = "PrismaSchemaNotFoundError";
  }
}

export class PrismaCommandError extends PrismaError {
  constructor(
    public readonly command: string[],
    public readonly exitCode: number,
    public readonly stderr: string,
  ) {
    super(`Comando prisma falló (exit ${String(exitCode)}): ${command.join(" ")}`);
    this.name = "PrismaCommandError";
  }
}

export class PrismaForbiddenCommandError extends PrismaError {
  constructor(command: string) {
    super(`Comando prisma no permitido (solo lectura): ${command}`);
    this.name = "PrismaForbiddenCommandError";
  }
}

export class PrismaValidationError extends PrismaError {
  constructor(message: string) {
    super(message);
    this.name = "PrismaValidationError";
  }
}
