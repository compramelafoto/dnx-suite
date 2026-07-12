import { ProviderError } from "../../utils/errors.js";

export class GitError extends ProviderError {
  constructor(message: string, cause?: unknown) {
    super("git", message, cause);
    this.name = "GitError";
  }
}

export class GitNotConfiguredError extends GitError {
  constructor(message = "Repositorio Git no configurado o no disponible") {
    super(message);
    this.name = "GitNotConfiguredError";
  }
}

export class GitNotRepositoryError extends GitError {
  constructor(path: string) {
    super(`No es un repositorio Git válido: ${path}`);
    this.name = "GitNotRepositoryError";
  }
}

export class GitCommandError extends GitError {
  constructor(
    public readonly command: string[],
    public readonly exitCode: number,
    public readonly stderr: string,
  ) {
    super(`Comando git falló (exit ${String(exitCode)}): ${command.join(" ")}`);
    this.name = "GitCommandError";
  }
}

export class GitForbiddenCommandError extends GitError {
  constructor(subcommand: string) {
    super(`Comando git no permitido (solo lectura): ${subcommand}`);
    this.name = "GitForbiddenCommandError";
  }
}

export class GitNoUpstreamError extends GitError {
  constructor(branch: string) {
    super(`La rama "${branch}" no tiene upstream configurado`);
    this.name = "GitNoUpstreamError";
  }
}

export class GitValidationError extends GitError {
  constructor(message: string) {
    super(message);
    this.name = "GitValidationError";
  }
}
