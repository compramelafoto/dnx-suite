import { spawn } from "node:child_process";
import { GitCommandError, GitForbiddenCommandError, GitValidationError } from "../errors.js";

const READ_ONLY_SUBCOMMANDS = new Set([
  "status",
  "rev-parse",
  "branch",
  "remote",
  "log",
  "tag",
  "describe",
  "diff",
  "show",
  "rev-list",
  "symbolic-ref",
  "ls-files",
]);

const FORBIDDEN_SUBCOMMANDS = new Set([
  "commit",
  "push",
  "pull",
  "fetch",
  "reset",
  "checkout",
  "switch",
  "merge",
  "rebase",
  "cherry-pick",
  "stash",
  "clean",
  "apply",
  "am",
  "bisect",
  "bundle",
  "filter-branch",
  "format-patch",
  "gc",
  "init",
  "mv",
  "notes",
  "pull",
  "push",
  "reflog",
  "restore",
  "rm",
  "submodule",
  "update-index",
  "update-ref",
  "worktree",
]);

const UNSAFE_ARG_PATTERN = /[\0\r\n|&;$`<>(){}[\]!#~]/;

export interface GitExecutorOptions {
  binary: string;
  cwd: string;
  timeoutMs?: number;
}

export interface GitRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitExecutor {
  private readonly binary: string;
  private readonly cwd: string;
  private readonly timeoutMs: number;

  constructor(options: GitExecutorOptions) {
    this.binary = options.binary;
    this.cwd = options.cwd;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async run(args: readonly string[]): Promise<GitRunResult> {
    validateGitArgs(args);

    return new Promise<GitRunResult>((resolvePromise, reject) => {
      const child = spawn(this.binary, [...args], {
        cwd: this.cwd,
        shell: false,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill("SIGTERM");
          reject(new GitCommandError([this.binary, ...args], -1, "Timeout ejecutando git"));
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

        const exitCode = code ?? -1;
        const result: GitRunResult = { stdout, stderr, exitCode };

        if (exitCode !== 0) {
          reject(new GitCommandError([this.binary, ...args], exitCode, stderr.trim()));
          return;
        }

        resolvePromise(result);
      });
    });
  }

  async runText(args: readonly string[]): Promise<string> {
    const result = await this.run(args);
    return result.stdout.trimEnd();
  }
}

export function validateGitArgs(args: readonly string[]): void {
  if (args.length === 0) {
    throw new GitValidationError("Se requiere al menos un argumento para git");
  }

  for (const arg of args) {
    if (UNSAFE_ARG_PATTERN.test(arg)) {
      throw new GitValidationError(`Argumento git inválido: ${arg}`);
    }
  }

  const subcommand = args[0] ?? "";

  if (FORBIDDEN_SUBCOMMANDS.has(subcommand)) {
    throw new GitForbiddenCommandError(subcommand);
  }

  if (subcommand === "config") {
    const hasReadFlag = args.some(
      (arg) => arg === "--get" || arg === "--get-regexp" || arg === "-l",
    );
    if (!hasReadFlag) {
      throw new GitForbiddenCommandError("config (solo --get/--get-regexp/-l)");
    }
    return;
  }

  if (!READ_ONLY_SUBCOMMANDS.has(subcommand)) {
    throw new GitForbiddenCommandError(subcommand);
  }
}
