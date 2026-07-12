import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReleaseOrchestratorError } from "../../orchestrators/release/index.js";
import type { ReleaseOrchestrator } from "../../orchestrators/release/index.js";
import { PlatformNotFoundError } from "../../platforms/index.js";
import { audit, errorResult, jsonResult, withAudit } from "../shared/index.js";
import { getReleaseOrchestrator, resolvePlatform } from "./context.js";
import { formatExecuteSkippedResponse, formatExecuteToolResponse } from "./responses.js";
import { releaseExecuteInputSchema } from "./schemas.js";

export async function handleReleaseExecute(
  input: { platformId: string; confirm: boolean; dryRun: boolean },
  orchestrator: ReleaseOrchestrator = getReleaseOrchestrator(),
) {
  const platform = resolvePlatform(input.platformId);

  if (!input.dryRun && !input.confirm) {
    return formatExecuteSkippedResponse(platform, input);
  }

  const result = await orchestrator.executeRelease({
    platform,
    dryRun: input.dryRun,
    confirm: input.confirm,
    target: "production",
  });

  return formatExecuteToolResponse(platform, result);
}

export function registerReleaseExecuteTool(
  server: McpServer,
  orchestrator: ReleaseOrchestrator = getReleaseOrchestrator(),
): void {
  server.registerTool(
    "release_execute",
    {
      title: "Release Execute",
      description:
        "Ejecuta el deploy de release vía Release Orchestrator. Por defecto dryRun: true y confirm: false (solo simula). Para producción: dryRun: false y confirm: true.",
      inputSchema: {
        platformId: releaseExecuteInputSchema.shape.platformId,
        confirm: releaseExecuteInputSchema.shape.confirm,
        dryRun: releaseExecuteInputSchema.shape.dryRun,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (rawInput) => {
      const input = releaseExecuteInputSchema.parse(rawInput);
      const skipped = !input.dryRun && !input.confirm;

      return withAudit(
        {
          tool: "release_execute",
          action: "execute",
          project: input.platformId,
          dryRun: input.dryRun,
          confirmed: input.confirm,
          ...(skipped ? { metadata: { skipped: true } } : {}),
        },
        async () => {
          audit({
            tool: "release_execute",
            action: "start",
            project: input.platformId,
            dryRun: input.dryRun,
            confirmed: input.confirm,
            outcome: skipped ? "skipped" : input.dryRun ? "dry_run" : "success",
          });

          try {
            const result = await handleReleaseExecute(input, orchestrator);
            const title = skipped
              ? `Release execute omitido: ${input.platformId}`
              : `Release execute: ${input.platformId}`;
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
