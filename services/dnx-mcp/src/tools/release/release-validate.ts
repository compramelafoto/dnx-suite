import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReleaseOrchestratorError } from "../../orchestrators/release/index.js";
import type { ReleaseOrchestrator } from "../../orchestrators/release/index.js";
import { PlatformNotFoundError } from "../../platforms/index.js";
import { audit, errorResult, jsonResult, withAudit } from "../shared/index.js";
import { getReleaseOrchestrator, resolvePlatform } from "./context.js";
import { formatValidateToolResponse } from "./responses.js";
import { releaseValidateInputSchema } from "./schemas.js";

export async function handleReleaseValidate(
  input: { platformId: string; dryRun: boolean },
  orchestrator: ReleaseOrchestrator = getReleaseOrchestrator(),
) {
  const platform = resolvePlatform(input.platformId);
  const result = await orchestrator.validateRelease({
    platform,
    dryRun: input.dryRun,
  });

  return formatValidateToolResponse(platform, result);
}

export function registerReleaseValidateTool(
  server: McpServer,
  orchestrator: ReleaseOrchestrator = getReleaseOrchestrator(),
): void {
  server.registerTool(
    "release_validate",
    {
      title: "Release Validate",
      description:
        "Valida readiness de staging/release y devuelve GO/NO-GO. Bloquea si DNX Brain, Git, Prisma o PostgreSQL impiden el release. Por defecto dryRun: true.",
      inputSchema: {
        platformId: releaseValidateInputSchema.shape.platformId,
        dryRun: releaseValidateInputSchema.shape.dryRun,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (rawInput) => {
      const input = releaseValidateInputSchema.parse(rawInput);

      return withAudit(
        {
          tool: "release_validate",
          action: "validate",
          project: input.platformId,
          dryRun: input.dryRun,
          confirmed: false,
        },
        async () => {
          audit({
            tool: "release_validate",
            action: "start",
            project: input.platformId,
            dryRun: input.dryRun,
            confirmed: false,
            outcome: input.dryRun ? "dry_run" : "success",
          });

          try {
            const result = await handleReleaseValidate(input, orchestrator);
            return jsonResult(result, `Release validate: ${input.platformId} → ${result.decision}`);
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
