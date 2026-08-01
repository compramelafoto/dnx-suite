import { evaluateAction } from "../safety/policy.js";
import { findCursorAgentBinary, getCursorAgentStatus, runCursorCommand } from "./discovery.js";
import type { CursorAgentStatus, CursorAskResult } from "./types.js";

export type CursorClientOptions = {
  preferredBin?: string;
  timeoutMs?: number;
  /**
   * ETAPA 01: always false. Kept for future stages.
   * Even if env allowWrite=true, foundation keeps this false.
   */
  writeExecutionEnabled?: boolean;
  runner?: typeof runCursorCommand;
  resolveBinaryFn?: () => Promise<string | null>;
  statusFn?: () => Promise<CursorAgentStatus>;
};

/**
 * Read-only Cursor Agent wrapper.
 * Never uses --force, --approve-mcps, or write-capable modes.
 */
export class CursorClient {
  private readonly preferredBin?: string;
  private readonly timeoutMs: number;
  private readonly writeExecutionEnabled: boolean;
  private readonly runner: typeof runCursorCommand;
  private readonly resolveBinaryFn?: () => Promise<string | null>;
  private readonly statusFn?: () => Promise<CursorAgentStatus>;

  constructor(options: CursorClientOptions = {}) {
    this.preferredBin = options.preferredBin;
    this.timeoutMs = options.timeoutMs ?? 300_000;
    this.writeExecutionEnabled = options.writeExecutionEnabled ?? false;
    this.runner = options.runner ?? runCursorCommand;
    this.resolveBinaryFn = options.resolveBinaryFn;
    this.statusFn = options.statusFn;
  }

  async resolveBinary(): Promise<string | null> {
    if (this.resolveBinaryFn) return this.resolveBinaryFn();
    const discovery = await findCursorAgentBinary(this.preferredBin);
    return discovery.path;
  }

  async about(): Promise<{ ok: boolean; output: string }> {
    const binary = await this.resolveBinary();
    if (!binary) return { ok: false, output: "BINARY_NOT_FOUND" };
    const result = await this.runner(binary, ["about"], { timeoutMs: 15_000 });
    return {
      ok: result.code === 0 && !result.timedOut,
      output: `${result.stdout}${result.stderr}`.trim(),
    };
  }

  async status(): Promise<CursorAgentStatus> {
    if (this.statusFn) return this.statusFn();
    return getCursorAgentStatus(this.preferredBin, { runner: this.runner });
  }

  /**
   * Fail-closed read-only ask.
   * Requires --mode ask and authenticated CLI. Never enables write tools.
   */
  async askReadOnly(input: { workspace: string; prompt: string }): Promise<CursorAskResult> {
    if (this.writeExecutionEnabled) {
      // ETAPA 01 still refuses write-capable paths; callers must keep this false.
      return {
        ok: false,
        code: "WRITE_DISABLED",
        message:
          "Write execution path is not implemented in ETAPA 01. Cursor remains read-only foundation.",
      };
    }

    const safety = evaluateAction("CURSOR_ASK", { writeExecutionEnabled: false });
    if (!safety.allowed) {
      return {
        ok: false,
        code: "READ_ONLY_NOT_GUARANTEED",
        message: safety.reason,
      };
    }

    if (!this.guaranteesReadOnly()) {
      return {
        ok: false,
        code: "READ_ONLY_NOT_GUARANTEED",
        message:
          "Cannot guarantee read-only Cursor execution with the current CLI flags. Fail-closed.",
      };
    }

    const binary = await this.resolveBinary();
    if (!binary) {
      return {
        ok: false,
        code: "BINARY_NOT_FOUND",
        message: "Cursor Agent binary not found.",
      };
    }

    const agentStatus = await this.status();
    if (agentStatus.auth === "CURSOR_AUTH_REQUIRED") {
      return {
        ok: false,
        code: "CURSOR_AUTH_REQUIRED",
        message:
          agentStatus.loginHint ??
          `CURSOR_AUTH_REQUIRED. Run manually: ${binary} login`,
      };
    }
    if (agentStatus.auth !== "AUTHENTICATED") {
      return {
        ok: false,
        code: "CURSOR_AUTH_REQUIRED",
        message: "Cursor auth status unknown or missing. Fail-closed until authenticated.",
      };
    }

    // Intentionally NOT executing prompts in ETAPA 01 by default callers.
    // This method still refuses unknown/write modes; if invoked, it uses ask mode only.
    const args = [
      "--mode",
      "ask",
      "--print",
      "--output-format",
      "text",
      "--workspace",
      input.workspace,
      input.prompt,
    ];

    // Extra fail-closed guard: reject if any forbidden flag sneaks in.
    const forbidden = ["--force", "--approve-mcps", "--sandbox=disabled"];
    if (args.some((a) => forbidden.includes(a))) {
      return {
        ok: false,
        code: "READ_ONLY_NOT_GUARANTEED",
        message: "Forbidden flags detected. Fail-closed.",
      };
    }

    try {
      const result = await this.runner(binary, args, { timeoutMs: this.timeoutMs });
      if (result.timedOut) {
        return { ok: false, code: "TIMEOUT", message: "Cursor ask timed out." };
      }
      if (result.code !== 0) {
        return {
          ok: false,
          code: "NON_ZERO_EXIT",
          message: `Cursor ask exited with code ${String(result.code)}`,
        };
      }
      return { ok: true, output: result.stdout.trim() };
    } catch (error) {
      return {
        ok: false,
        code: "SPAWN_ERROR",
        message: error instanceof Error ? error.message : "Unknown spawn error",
      };
    }
  }

  /**
   * ETAPA 01 contract: we only claim read-only when using --mode ask
   * and never enabling force/MCP auto-approval/write mode.
   */
  guaranteesReadOnly(): boolean {
    // Hard lock for foundation stage.
    if (this.writeExecutionEnabled) return false;
    return true;
  }
}
