import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReleaseOrchestratorError } from "../../orchestrators/release/index.js";
import type { ReleaseOrchestrator } from "../../orchestrators/release/index.js";
import { PlatformNotFoundError } from "../../platforms/index.js";
import { audit, errorResult, jsonResult, withAudit } from "../shared/index.js";
import { getReleaseOrchestrator, resolvePlatform } from "./context.js";
import { formatRollbackSkippedResponse, formatRollbackToolResponse } from "./responses.js";
import { releaseRollbackInputSchema } from "./schemas.js";

export async function handleReleaseRollback(
  input: { platformId: string; confirm: boolean; dryRun: boolean },
  orchestrator: ReleaseOrchestrator = getReleaseOrchestrator(),
) {
  const platform = resolvePlatform(input.platformId);

  if (!input.dryRun && !input.confirm) {
    return formatRollbackSkippedResponse(platform, input);
  }

  const result = await orchestrator.rollbackRelease({
    platform,
    dryRun: input.dryRun,
    confirm: input.confirm,
    target: "production",
  });

  return formatRollbackToolResponse(platform, result);
}

export function registerReleaseRollbackTool(
  server: McpServer,
  orchestrator: ReleaseOrchestrator = getReleaseOrchestrator(),
): void {
  server.registerTool(
    "release_rollback",
    {
      title: "Release Rollback",
      description:
        "Revierte el release al deployment anterior. Por defecto dryRun: true y confirm: false (solo simula). Para producción: dryRun: false y confirm: true.",
      inputSchema: {
        platformId: releaseRollbackInputSchema.shape.platformId,
        confirm: releaseRollbackInputSchema.shape.confirm,
        dryRun: releaseRollbackInputSchema.shape.dryRun,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (rawInput) => {
      const input = releaseRollbackInputSchema.parse(rawInput);
      const skipped = !input.dryRun && !input.confirm;

      return withAudit(
        {
          tool: "release_rollback",
          action: "rollback",
          project: input.platformId,
          dryRun: input.dryRun,
          confirmed: input.confirm,
          ...(skipped ? { metadata: { skipped: true } } : {}),
        },
        async () => {
          audit({
            tool: "release_rollback",
            action: "start",
            project: input.platformId,
            dryRun: input.dryRun,
            confirmed: input.confirm,
            outcome: skipped ? "skipped" : input.dryRun ? "dry_run" : "success",
          });

          try {
            const result = await handleReleaseRollback(input, orchestrator);
            const title = skipped
              ? `Release rollback omitido: ${input.platformId}`
              : `Release rollback: ${input.platformId}`;
            return jsonResult(result, title);
          } catch (error) {
            if (error instanceof PlatformNotFoundError) {
              return errorResult(error.message, { platformId: input.platformId });
            }
            if (error instanceof ReleaseOrchestratorError) {
              return errorResult(error.message, {
                platformId: input.platformId,
                blocked: true,
              });
            }
            throw error;
          }
        },
      );
    },
  );
}
