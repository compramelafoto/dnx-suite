import { spawn } from "node:child_process";
import {
  PrismaCommandError,
  PrismaForbiddenCommandError,
  PrismaValidationError,
} from "../errors.js";

const UNSAFE_ARG_PATTERN = /[\0\r\n|&;$`<>(){}[\]!#~]/;

const FORBIDDEN_TOP_LEVEL = new Set([
  "db",
  "generate",
  "init",
  "studio",
  "version",
  "seed",
  "introspect",
]);

const FORBIDDEN_MIGRATE_SUBCOMMANDS = new Set([
  "dev",
  "deploy",
  "reset",
  "resolve",
  "diff",
  "apply",
]);

export interface PrismaExecutorOptions {
  binary: string;
  cwd: string;
  timeoutMs?: number;
}

export interface PrismaRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class PrismaExecutor {
  private readonly binary: string;
  private readonly cwd: string;
  private readonly timeoutMs: number;

  constructor(options: PrismaExecutorOptions) {
    this.binary = options.binary;
    this.cwd = options.cwd;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async run(args: readonly string[]): Promise<PrismaRunResult> {
    validatePrismaArgs(args);

    return new Promise<PrismaRunResult>((resolvePromise, reject) => {
      const child = spawn(this.binary, [...args], {
        cwd: this.cwd,
        shell: false,
        windowsHide: true,
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill("SIGTERM");
          reject(new PrismaCommandError([this.binary, ...args], -1, "Timeout ejecutando prisma"));
        }
      }, this.timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });

      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });

      child.on("error", (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      });

      child.on("close", (code) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);

        resolvePromise({
          stdout,
          stderr,
          exitCode: code ?? -1,
        });
      });
    });
  }

  async runText(args: readonly string[]): Promise<string> {
    const result = await this.run(args);
    return `${result.stdout}${result.stderr}`.trimEnd();
  }

  async runExpectSuccess(args: readonly string[]): Promise<string> {
    const result = await this.run(args);
    if (result.exitCode !== 0) {
      throw new PrismaCommandError(
        [this.binary, ...args],
        result.exitCode,
        `${result.stderr}\n${result.stdout}`.trim(),
      );
    }
    return result.stdout.trimEnd();
  }
}

export function validatePrismaArgs(args: readonly string[]): void {
  if (args.length === 0) {
    throw new PrismaValidationError("Se requiere al menos un argumento para prisma");
  }

  for (const arg of args) {
    if (UNSAFE_ARG_PATTERN.test(arg)) {
      throw new PrismaValidationError(`Argumento prisma inválido: ${arg}`);
    }
  }

  const topLevel = args[0] ?? "";

  if (FORBIDDEN_TOP_LEVEL.has(topLevel)) {
    throw new PrismaForbiddenCommandError(topLevel);
  }

  if (topLevel === "validate") {
    return;
  }

  if (topLevel === "format") {
    if (!args.includes("--check")) {
      throw new PrismaForbiddenCommandError("format (solo --check permitido)");
    }
    return;
  }

  if (topLevel === "migrate") {
    const subcommand = args[1];
    if (!subcommand || subcommand.startsWith("-")) {
      throw new PrismaForbiddenCommandError("migrate (subcomando requerido)");
    }
    if (FORBIDDEN_MIGRATE_SUBCOMMANDS.has(subcommand)) {
      throw new PrismaForbiddenCommandError(`migrate ${subcommand}`);
    }
    if (subcommand !== "status") {
      throw new PrismaForbiddenCommandError(`migrate ${subcommand}`);
    }
    return;
  }

  throw new PrismaForbiddenCommandError(topLevel);
}
