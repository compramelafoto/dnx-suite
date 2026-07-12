import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { VercelProvider } from "../../providers/vercel/index.js";
import { vercelProvider } from "../../providers/vercel/index.js";
import { extractBuildInfo } from "../../providers/vercel/types/build.js";
import {
  audit,
  confirmSchema,
  deploymentTargetSchema,
  dryRunSchema,
  jsonResult,
  projectSchema,
  resolveExecutionGate,
  timeoutMsSchema,
  withAudit,
} from "../shared/index.js";
import { getVercelProvider, summarizeDeployment } from "./context.js";

const inputSchema = {
  project: projectSchema,
  target: deploymentTargetSchema,
  dryRun: dryRunSchema,
  confirm: confirmSchema,
  timeoutMs: timeoutMsSchema,
};

export async function handleVercelRollbackRelease(
  provider: VercelProvider,
  input: {
    project: string;
    target: "production" | "preview" | "development";
    dryRun: boolean;
    confirm: boolean;
    timeoutMs: number;
  },
) {
  const gate = resolveExecutionGate(input, "rollback_release");
  const project = await provider.projects.findOne(input.project);

  const healthyDeployments = await provider.deployments.list({
    projectId: project.id,
    target: input.target,
    state: "READY",
    limit: 5,
  });

  const current = healthyDeployments[0] ?? null;
  const rollbackTarget = healthyDeployments[1] ?? null;

  const plan = {
    project: project.name,
    target: input.target,
    currentDeployment: current ? summarizeDeployment(current) : null,
    rollbackTo: rollbackTarget ? summarizeDeployment(rollbackTarget) : null,
    action: rollbackTarget
      ? `redeploy ${rollbackTarget.id} (deployment anterior sano)`
      : "no_rollback_available",
  };

  if (!rollbackTarget) {
    return {
      dryRun: gate.dryRun,
      executed: false,
      plan,
      success: false,
      message: "No hay deployment anterior sano disponible para rollback.",
    };
  }

  if (gate.dryRun || !gate.proceed) {
    return {
      dryRun: true,
      executed: false,
      plan,
      message: "Simulación de rollback. Usa confirm: true para ejecutar.",
    };
  }

  const deployment = await provider.deployments.redeploy({
    deploymentId: rollbackTarget.id,
    target: input.target,
  });

  const ready = await provider.waitUntilDeploymentReady(deployment.id, {
    timeoutMs: input.timeoutMs,
    pollIntervalMs: 5_000,
  });

  const health = provider.getDeploymentHealth(ready);
  const build = extractBuildInfo(ready);
  const aliases = await provider.deployments.getAliases(ready.id);
  const success = health === "healthy";

  return {
    executed: true,
    dryRun: false,
    project: project.name,
    rolledBackFrom: current ? summarizeDeployment(current) : null,
    deployment: summarizeDeployment(ready),
    health,
    build,
    aliases,
    success,
    summary: success
      ? `Rollback exitoso a ${rollbackTarget.id}`
      : `Rollback completado con estado: ${health}`,
  };
}

export function registerVercelRollbackReleaseTool(
  server: McpServer,
  provider: VercelProvider = vercelProvider,
): void {
  server.registerTool(
    "vercel_rollback_release",
    {
      title: "Vercel Rollback Release",
      description:
        "Encuentra el último deployment sano anterior, hace redeploy, espera y valida. Requiere confirm: true.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);

      return withAudit(
        {
          tool: "vercel_rollback_release",
          action: "rollback_release",
          project: parsed.project,
          dryRun: parsed.dryRun,
          confirmed: parsed.confirm,
        },
        async () => {
          audit({
            tool: "vercel_rollback_release",
            action: "start",
            project: parsed.project,
            dryRun: parsed.dryRun,
            confirmed: parsed.confirm,
            outcome: parsed.dryRun ? "dry_run" : "success",
            metadata: { target: parsed.target },
          });

          const activeProvider = getVercelProvider(provider);
          const result = await handleVercelRollbackRelease(activeProvider, parsed);
          return jsonResult(result, `Rollback release: ${parsed.project}`);
        },
      );
    },
  );
}
