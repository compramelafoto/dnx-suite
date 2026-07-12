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
  redeployFrom: z
    .string()
    .optional()
    .describe("ID de deployment a redeployar. Por defecto usa el preview actual."),
  dryRun: dryRunSchema,
  confirm: confirmSchema,
  timeoutMs: timeoutMsSchema,
};

export async function handleVercelDeployRelease(
  provider: VercelProvider,
  input: {
    project: string;
    target: "production" | "preview" | "development";
    redeployFrom?: string | undefined;
    dryRun: boolean;
    confirm: boolean;
    timeoutMs: number;
  },
) {
  const gate = resolveExecutionGate(input, "deploy_release");

  const project = await provider.projects.findOne(input.project);
  const candidate = input.redeployFrom
    ? await provider.deployments.get(input.redeployFrom)
    : await provider.helpers.getPreviewDeployment(project.name);

  const plan = {
    project: project.name,
    target: input.target,
    candidateDeployment: candidate ? summarizeDeployment(candidate) : null,
    action: candidate
      ? `redeploy ${candidate.id} → ${input.target}`
      : `deploy ${project.name} → ${input.target}`,
    domainsWillChange: false,
    note: "Los dominios no se modifican en esta operación.",
  };

  if (gate.dryRun || !gate.proceed) {
    return {
      dryRun: true,
      plan,
      executed: false,
      message: "Simulación completada. Usa confirm: true para ejecutar.",
    };
  }

  const deployment = await provider.deployAndWait(project.name, {
    target: input.target,
    ...(candidate ? { redeployFrom: candidate.id } : {}),
    timeoutMs: input.timeoutMs,
    pollIntervalMs: 5_000,
  });

  const health = provider.getDeploymentHealth(deployment);
  const build = extractBuildInfo(deployment);
  const aliases = await provider.deployments.getAliases(deployment.id);
  const buildLogs = await provider.logs.getBuildLogs(deployment.id, { limit: 20 });

  const success = health === "healthy";

  return {
    executed: true,
    dryRun: false,
    project: project.name,
    deployment: summarizeDeployment(deployment),
    health,
    build,
    aliases,
    buildLogTail: provider.logs.formatLogs(buildLogs).split("\n").slice(-5).join("\n"),
    success,
    summary: success
      ? `Deploy exitoso: ${deployment.id} (${deployment.url ?? "sin url"})`
      : `Deploy completado con problemas: estado ${health}`,
    domainsChanged: false,
  };
}

export function registerVercelDeployReleaseTool(
  server: McpServer,
  provider: VercelProvider = vercelProvider,
): void {
  server.registerTool(
    "vercel_deploy_release",
    {
      title: "Vercel Deploy Release",
      description:
        "Despliega a producción (o target indicado), espera el deployment, monitorea salud y devuelve resumen. Requiere confirm: true. No modifica dominios.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);

      return withAudit(
        {
          tool: "vercel_deploy_release",
          action: "deploy_release",
          project: parsed.project,
          dryRun: parsed.dryRun,
          confirmed: parsed.confirm,
        },
        async () => {
          audit({
            tool: "vercel_deploy_release",
            action: "start",
            project: parsed.project,
            dryRun: parsed.dryRun,
            confirmed: parsed.confirm,
            outcome: parsed.dryRun ? "dry_run" : "success",
            metadata: { target: parsed.target },
          });

          const activeProvider = getVercelProvider(provider);
          const result = await handleVercelDeployRelease(activeProvider, parsed);
          return jsonResult(result, `Deploy release: ${parsed.project}`);
        },
      );
    },
  );
}
