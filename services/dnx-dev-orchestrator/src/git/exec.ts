import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitExecResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type GitExecOptions = {
  cwd: string;
  timeoutMs?: number;
};

/**
 * Safe git invocation — never concatenates user input into a shell string.
 */
export async function gitExec(
  args: string[],
  options: GitExecOptions,
): Promise<GitExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: options.cwd,
      timeout: options.timeoutMs ?? 60_000,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
      },
    });
    return {
      code: 0,
      stdout: typeof stdout === "string" ? stdout : String(stdout),
      stderr: typeof stderr === "string" ? stderr : String(stderr),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & {
      code?: number | string;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      killed?: boolean;
      signal?: string;
    };
    const exitCode = typeof err.code === "number" ? err.code : 1;
    return {
      code: exitCode,
      stdout: err.stdout ? String(err.stdout) : "",
      stderr: err.stderr ? String(err.stderr) : err.message,
    };
  }
}

export async function gitOk(args: string[], options: GitExecOptions): Promise<string> {
  const result = await gitExec(args, options);
  if (result.code !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}
