import { spawn } from "node:child_process";
import type { GoogleCloudConfig } from "./config.js";
import { GoogleCloudError } from "./errors.js";
import { redactSecrets, scrubExactValue } from "./redact.js";
import type { GcpAllowedCommand, GcpRunResult } from "./types.js";

export type GcpExecutorFn = (
  command: GcpAllowedCommand,
  options?: { timeoutMs?: number; maxOutputBytes?: number },
) => Promise<GcpRunResult>;

export function buildGcloudArgs(command: GcpAllowedCommand): {
  args: string[];
  stdin?: string;
} {
  switch (command.op) {
    case "version":
      return { args: ["version", "--format=json"] };
    case "info":
      return { args: ["info", "--format=json"] };
    case "auth.list":
      return { args: ["auth", "list", "--format=json"] };
    case "config.get":
      return { args: ["config", "get-value", command.key] };
    case "config.set":
      return { args: ["config", "set", command.key, command.value] };
    case "projects.list":
      return { args: ["projects", "list", "--format=json"] };
    case "projects.describe":
      return { args: ["projects", "describe", command.projectId, "--format=json"] };
    case "billing.describe":
      return {
        args: ["billing", "projects", "describe", command.projectId, "--format=json"],
      };
    case "services.list.enabled":
      return {
        args: [
          "services",
          "list",
          "--enabled",
          `--project=${command.projectId}`,
          "--format=json",
        ],
      };
    case "services.list.available":
      return {
        args: [
          "services",
          "list",
          "--available",
          `--project=${command.projectId}`,
          "--format=json",
          "--filter=name:googleapis.com",
          "--limit=200",
        ],
      };
    case "services.enable":
      return {
        args: [
          "services",
          "enable",
          ...command.services,
          `--project=${command.projectId}`,
        ],
      };
    case "iam.sa.list":
      return {
        args: [
          "iam",
          "service-accounts",
          "list",
          `--project=${command.projectId}`,
          "--format=json",
        ],
      };
    case "iam.sa.create": {
      const args = [
        "iam",
        "service-accounts",
        "create",
        command.accountId,
        `--project=${command.projectId}`,
        "--format=json",
      ];
      if (command.displayName) args.push(`--display-name=${command.displayName}`);
      if (command.description) args.push(`--description=${command.description}`);
      return { args };
    }
    case "secrets.list":
      return {
        args: ["secrets", "list", `--project=${command.projectId}`, "--format=json"],
      };
    case "secrets.describe":
      return {
        args: [
          "secrets",
          "describe",
          command.secretId,
          `--project=${command.projectId}`,
          "--format=json",
        ],
      };
    case "secrets.create":
      return {
        args: [
          "secrets",
          "create",
          command.secretId,
          `--project=${command.projectId}`,
          "--replication-policy=automatic",
          "--format=json",
        ],
      };
    case "secrets.versions.add":
      return {
        args: [
          "secrets",
          "versions",
          "add",
          command.secretId,
          `--project=${command.projectId}`,
          "--data-file=-",
          "--format=json",
        ],
        stdin: command.secretValue,
      };
    default: {
      const _exhaustive: never = command;
      throw new GoogleCloudError("GCP_INVALID_INPUT", `Comando no permitido: ${String(_exhaustive)}`);
    }
  }
}

export function createGoogleCloudExecutor(config: GoogleCloudConfig): GcpExecutorFn {
  return async (command, options = {}) => {
    const { args, stdin } = buildGcloudArgs(command);
    const timeoutMs = options.timeoutMs ?? config.commandTimeoutMs;
    const maxOutputBytes = options.maxOutputBytes ?? config.maxOutputBytes;
    const secretValue = command.op === "secrets.versions.add" ? command.secretValue : undefined;

    return new Promise<GcpRunResult>((resolve, reject) => {
      const startedAt = Date.now();
      const child = spawn(config.binary, args, {
        shell: false,
        windowsHide: true,
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;
      let stdoutBytes = 0;
      let stderrBytes = 0;

      const finishReject = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill("SIGTERM");
        reject(error);
      };

      const timer = setTimeout(() => {
        finishReject(
          new GoogleCloudError("GCP_TIMEOUT", `Timeout ejecutando gcloud (${String(timeoutMs)}ms)`, {
            causeHint: "Aumentá DNX_GCP_COMMAND_TIMEOUT_MS si la operación es legítima.",
          }),
        );
      }, timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      child.stdout.on("data", (chunk: string) => {
        stdoutBytes += Buffer.byteLength(chunk, "utf8");
        if (stdoutBytes > maxOutputBytes) {
          finishReject(
            new GoogleCloudError("GCP_OUTPUT_TOO_LARGE", "stdout de gcloud excedió el límite", {
              recommendedAction: "Reducí el alcance del query o aumentá DNX_GCP_MAX_OUTPUT_BYTES.",
            }),
          );
          return;
        }
        stdout += chunk;
      });

      child.stderr.on("data", (chunk: string) => {
        stderrBytes += Buffer.byteLength(chunk, "utf8");
        if (stderrBytes > maxOutputBytes) {
          finishReject(
            new GoogleCloudError("GCP_OUTPUT_TOO_LARGE", "stderr de gcloud excedió el límite"),
          );
          return;
        }
        stderr += chunk;
      });

      child.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") {
          finishReject(
            new GoogleCloudError(
              "GCP_CLI_NOT_INSTALLED",
              `Binario gcloud no encontrado (${config.binary})`,
              {
                recommendedAction: "Instalá Google Cloud SDK y asegurate de que gcloud esté en PATH.",
              },
            ),
          );
          return;
        }
        finishReject(
          new GoogleCloudError("GCP_CLI_EXECUTION_FAILED", "No se pudo iniciar gcloud", {
            cause: error,
            causeHint: error.message,
          }),
        );
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        const safeStdout = scrubExactValue(redactSecrets(stdout), secretValue);
        const safeStderr = scrubExactValue(redactSecrets(stderr), secretValue);
        const exitCode = code ?? -1;

        if (exitCode !== 0) {
          const combined = `${safeStderr}\n${safeStdout}`.toLowerCase();
          let errCode: GoogleCloudError["code"] = "GCP_CLI_EXECUTION_FAILED";
          if (combined.includes("permission") || combined.includes("403")) {
            errCode = "GCP_PERMISSION_DENIED";
          } else if (combined.includes("not found") || combined.includes("404")) {
            errCode = "GCP_PROJECT_NOT_FOUND";
          }

          const hint = safeStderr.slice(0, 500) || safeStdout.slice(0, 500);
          reject(
            new GoogleCloudError(errCode, `gcloud falló (exit ${String(exitCode)})`, {
              ...(hint ? { causeHint: hint } : {}),
            }),
          );
          return;
        }

        resolve({
          stdout: safeStdout,
          stderr: safeStderr,
          exitCode,
          args,
          durationMs: Date.now() - startedAt,
        });
      });

      if (stdin !== undefined) {
        child.stdin.write(stdin);
        child.stdin.end();
      } else {
        child.stdin.end();
      }
    });
  };
}

export function parseJsonOutput<T>(stdout: string, fallback: T): T {
  const trimmed = stdout.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}
