import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReleaseOrchestratorError } from "../../orchestrators/release/index.js";
import type { ReleaseOrchestrator } from "../../orchestrators/release/index.js";
import { PlatformNotFoundError } from "../../platforms/index.js";
import { audit, errorResult, jsonResult, withAudit } from "../shared/index.js";
import { getReleaseOrchestrator, resolvePlatform } from "./context.js";
import { formatPrepareToolResponse } from "./responses.js";
import { releasePrepareInputSchema } from "./schemas.js";

export async function handleReleasePrepare(
  input: { platformId: string; dryRun: boolean },
  orchestrator: ReleaseOrchestrator = getReleaseOrchestrator(),
) {
  const platform = resolvePlatform(input.platformId);
  const result = await orchestrator.prepareRelease({
    platform,
    dryRun: input.dryRun,
  });

  return formatPrepareToolResponse(platform, result);
}

export function registerReleasePrepareTool(
  server: McpServer,
  orchestrator: ReleaseOrchestrator = getReleaseOrchestrator(),
): void {
  server.registerTool(
    "release_prepare",
    {
      title: "Release Prepare",
      description:
        "Prepara un release: audita Vercel staging/status, evalúa Git/Prisma/PostgreSQL y consulta DNX Brain. Por defecto dryRun: true.",
      inputSchema: {
        platformId: releasePrepareInputSchema.shape.platformId,
        dryRun: releasePrepareInputSchema.shape.dryRun,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (rawInput) => {
      const input = releasePrepareInputSchema.parse(rawInput);

      return withAudit(
        {
          tool: "release_prepare",
          action: "prepare",
          project: input.platformId,
          dryRun: input.dryRun,
          confirmed: false,
        },
        async () => {
          audit({
            tool: "release_prepare",
            action: "start",
            project: input.platformId,
            dryRun: input.dryRun,
            confirmed: false,
            outcome: input.dryRun ? "dry_run" : "success",
          });

          try {
            const result = await handleReleasePrepare(input, orchestrator);
            return jsonResult(result, `Release prepare: ${input.platformId}`);
          } catch (error) {
            if (error instanceof PlatformNotFoundError) {
              return errorResult(error.message, { platformId: input.platformId });
            }
            if (error instanceof ReleaseOrchestratorError) {
              return errorResult(error.message, { platformId: input.platformId });
            }
            throw error;
          }
        },
      );
    },
  );
}
