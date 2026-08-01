import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { CursorAgentStatus, CursorAuthStatus, CursorBinaryDiscovery } from "./types.js";

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

function which(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("which", [command], { stdio: ["ignore", "pipe", "ignore"] });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const line = stdout.trim().split("\n")[0]?.trim();
      resolve(line || null);
    });
  });
}

export type DiscoveryDeps = {
  whichFn?: (command: string) => Promise<string | null>;
  pathExistsFn?: (path: string) => Promise<boolean>;
  homeDir?: string;
};

export async function findCursorAgentBinary(
  preferredBin?: string,
  deps: DiscoveryDeps = {},
): Promise<CursorBinaryDiscovery> {
  const whichFn = deps.whichFn ?? which;
  const pathExistsFn = deps.pathExistsFn ?? pathExists;
  const home = deps.homeDir ?? homedir();

  const localAgent = join(home, ".local", "bin", "agent");
  const localCursorAgent = join(home, ".local", "bin", "cursor-agent");

  if (preferredBin?.trim()) {
    const path = preferredBin.trim();
    if (await pathExistsFn(path)) {
      return { found: true, path, source: "env" };
    }
  }

  const whichAgent = await whichFn("agent");
  if (whichAgent && (await pathExistsFn(whichAgent))) {
    return { found: true, path: whichAgent, source: "which-agent" };
  }

  if (await pathExistsFn(localAgent)) {
    return { found: true, path: localAgent, source: "local-agent" };
  }

  const whichCursorAgent = await whichFn("cursor-agent");
  if (whichCursorAgent && (await pathExistsFn(whichCursorAgent))) {
    return { found: true, path: whichCursorAgent, source: "which-cursor-agent" };
  }

  if (await pathExistsFn(localCursorAgent)) {
    return { found: true, path: localCursorAgent, source: "local-cursor-agent" };
  }

  return { found: false, path: null, source: null };
}

export function runCursorCommand(
  binary: string,
  args: string[],
  options: { timeoutMs?: number } = {},
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        // Prevent accidental browser login prompts during discovery.
        NO_OPEN_BROWSER: "1",
      },
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      resolve({ code: null, stdout, stderr, timedOut: true });
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}\n${error.message}`, timedOut: false });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut: false });
    });
  });
}

function redactSecrets(text: string): string {
  return text
    .replace(/(api[_-]?key|token|secret)\s*[=:]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/sk-[a-zA-Z0-9]{10,}/g, "[REDACTED]");
}

export async function getCursorAgentVersion(
  binary: string,
  runner: typeof runCursorCommand = runCursorCommand,
): Promise<string | null> {
  const result = await runner(binary, ["--version"], { timeoutMs: 10_000 });
  const text = redactSecrets(`${result.stdout}\n${result.stderr}`).trim();
  if (!text) return null;
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean);
  return firstLine ?? null;
}

function parseAuthStatus(combined: string): { auth: CursorAuthStatus; detail: string } {
  const text = redactSecrets(combined).toLowerCase();
  if (text.includes("not logged in") || text.includes("not authenticated")) {
    return {
      auth: "CURSOR_AUTH_REQUIRED",
      detail: "Cursor Agent reports not logged in.",
    };
  }
  if (
    text.includes("logged in") ||
    text.includes("authenticated") ||
    /user email\s+\S+@\S+/i.test(combined)
  ) {
    // Avoid treating "Not logged in" / "User Email Not logged in" as authenticated.
    if (!text.includes("not logged in") && !text.includes("user email          not logged in")) {
      return {
        auth: "AUTHENTICATED",
        detail: "Cursor Agent appears authenticated.",
      };
    }
  }
  return {
    auth: "UNKNOWN",
    detail: "Could not determine Cursor auth status from CLI output.",
  };
}

export async function getCursorAgentStatus(
  preferredBin?: string,
  deps: DiscoveryDeps & { runner?: typeof runCursorCommand } = {},
): Promise<CursorAgentStatus> {
  const binary = await findCursorAgentBinary(preferredBin, deps);
  if (!binary.found || !binary.path) {
    return {
      binary,
      version: null,
      auth: "BINARY_NOT_FOUND",
      authDetail: "Cursor Agent CLI binary not found.",
      loginHint: null,
    };
  }

  const runner = deps.runner ?? runCursorCommand;
  const version = await getCursorAgentVersion(binary.path, runner);
  const statusResult = await runner(binary.path, ["status"], { timeoutMs: 15_000 });
  const aboutResult = await runner(binary.path, ["about"], { timeoutMs: 15_000 });
  const combined = `${statusResult.stdout}\n${statusResult.stderr}\n${aboutResult.stdout}\n${aboutResult.stderr}`;
  const { auth, detail } = parseAuthStatus(combined);

  return {
    binary,
    version,
    auth,
    authDetail: detail,
    loginHint:
      auth === "CURSOR_AUTH_REQUIRED"
        ? `Run manually: ${binary.path} login`
        : null,
  };
}
