import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listPlatforms } from "../../platforms/index.js";
import type { VercelProvider } from "../../providers/vercel/index.js";
import {
  protectionBypassStatus,
  runDeploymentHttpProbes,
  vercelProvider,
} from "../../providers/vercel/index.js";
import { extractBuildInfo } from "../../providers/vercel/types/build.js";
import {
  audit,
  dryRunSchema,
  isDryRunPreview,
  jsonResult,
  projectSchema,
  withAudit,
} from "../shared/index.js";
import { getVercelProvider, summarizeDeployment } from "./context.js";

const inputSchema = {
  project: projectSchema,
  deploymentId: z
    .string()
    .optional()
    .describe("ID del deployment a validar. Por defecto usa el preview actual."),
  dryRun: dryRunSchema,
};

function findPlatformByVercelProject(projectName: string) {
  return listPlatforms().find((p) => p.vercelProject === projectName);
}

function summarizeProbes(suite: Awaited<ReturnType<typeof runDeploymentHttpProbes>>): Array<{
  url: string;
  method: string;
  ok: boolean;
  status: number | null;
  protectionBlocked: boolean;
  bypassApplied: boolean;
  error: string | null;
}> {
  return suite.probes.map((p) => ({
    url: p.url,
    method: p.method,
    ok: p.ok,
    status: p.status,
    protectionBlocked: p.protectionBlocked,
    bypassApplied: p.bypassApplied,
    error: p.error,
  }));
}

export async function handleVercelValidateStaging(
  provider: VercelProvider,
  input: { project: string; deploymentId?: string | undefined; dryRun: boolean },
) {
  if (isDryRunPreview(input)) {
    return {
      dryRun: true,
      project: input.project,
      wouldValidate: [
        "deployment_ready",
        "health",
        "build",
        "runtime_logs",
        "aliases",
        "env_vars",
        "http_probes",
      ],
      protectionBypass: protectionBypassStatus(),
    };
  }

  const project = await provider.projects.findOne(input.project);
  const deployment = input.deploymentId
    ? await provider.deployments.get(input.deploymentId)
    : await provider.helpers.getPreviewDeployment(project.name);

  if (!deployment) {
    return {
      project: project.name,
      passed: false,
      issues: ["No se encontró deployment de preview para validar."],
      report: null,
    };
  }

  const health = provider.getDeploymentHealth(deployment);
  const build = extractBuildInfo(deployment);
  const aliases = await provider.deployments.getAliases(deployment.id);
  const envs = await provider.envVars.list(project.name);
  const previewEnvs = envs.filter((env) => env.target?.includes("preview"));
  const productionEnvs = envs.filter((env) => env.target?.includes("production"));

  const [buildLogs, runtimeLogs] = await Promise.all([
    provider.logs.getBuildLogs(deployment.id, { limit: 100 }),
    provider.logs.getRuntimeLogs(project.id, deployment.id, { limit: 50 }),
  ]);

  const buildLogText = provider.logs.formatLogs(buildLogs);
  const runtimeLogText = provider.logs.formatLogs(runtimeLogs);
  const buildHasErrors = buildLogText.toLowerCase().includes("error") || build.state === "ERROR";
  const runtimeHasErrors = runtimeLogText.toLowerCase().includes("error");

  const issues: string[] = [];

  if (health !== "healthy") {
    issues.push(`Deployment no saludable: ${health}`);
  }

  if (build.state === "ERROR" || buildHasErrors) {
    issues.push("Build con errores detectados en logs o estado.");
  }

  if (runtimeHasErrors) {
    issues.push("Errores detectados en runtime logs.");
  }

  if (previewEnvs.length === 0) {
    issues.push("No hay variables de entorno configuradas para preview.");
  }

  const missingForProd = previewEnvs
    .filter((preview) => !productionEnvs.some((prod) => prod.key === preview.key))
    .map((env) => env.key);

  if (missingForProd.length > 0) {
    issues.push(`Variables en preview ausentes en production: ${missingForProd.join(", ")}`);
  }

  if (aliases.length === 0) {
    issues.push("El deployment no tiene aliases asignados.");
  }

  const bypass = protectionBypassStatus();
  let httpProbes: ReturnType<typeof summarizeProbes> | null = null;

  const deploymentUrl = deployment.url;
  if (deploymentUrl) {
    const platform = findPlatformByVercelProject(project.name);
    const rootSmoke = [
      {
        id: "deployment-root",
        name: "Deployment root",
        target: "/",
        type: "http" as const,
      },
    ];
    const suite = await runDeploymentHttpProbes({
      baseUrl: deploymentUrl,
      ...(platform?.healthEndpoints ? { healthEndpoints: platform.healthEndpoints } : {}),
      smokeTests: platform && platform.smokeTests.length > 0 ? platform.smokeTests : rootSmoke,
    });

    const effective =
      suite.probes.length > 0
        ? suite
        : await runDeploymentHttpProbes({
            baseUrl: deploymentUrl,
            smokeTests: rootSmoke,
          });

    httpProbes = summarizeProbes(effective);
    issues.push(...effective.issues);
  } else {
    issues.push("Deployment sin URL pública; no se pudieron ejecutar HTTP probes.");
  }

  const passed = issues.length === 0 && health === "healthy";

  const report = {
    project: project.name,
    deployment: summarizeDeployment(deployment),
    health,
    build: {
      ...build,
      logSample: buildLogText.split("\n").slice(-10).join("\n"),
      hasErrors: buildHasErrors,
    },
    runtime: {
      logSample: runtimeLogText.split("\n").slice(-10).join("\n"),
      hasErrors: runtimeHasErrors,
    },
    aliases,
    envVars: {
      previewCount: previewEnvs.length,
      productionCount: productionEnvs.length,
      missingInProduction: missingForProd,
    },
    protectionBypass: {
      enabled: bypass.enabled,
      header: bypass.header,
    },
    httpProbes,
    issues,
    passed,
    summary: passed
      ? "Staging validado correctamente. Listo para planificar release."
      : `Staging con ${String(issues.length)} problema(s) detectado(s).`,
  };

  return report;
}

export function registerVercelValidateStagingTool(
  server: McpServer,
  provider: VercelProvider = vercelProvider,
): void {
  server.registerTool(
    "vercel_validate_staging",
    {
      title: "Vercel Validate Staging",
      description:
        "Valida el deployment de staging: salud, build, runtime logs, aliases, variables y HTTP probes (con Protection Bypass si está configurado).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);

      return withAudit(
        {
          tool: "vercel_validate_staging",
          action: "validate_staging",
          project: parsed.project,
          dryRun: parsed.dryRun,
          confirmed: false,
        },
        async () => {
          audit({
            tool: "vercel_validate_staging",
            action: "start",
            project: parsed.project,
            dryRun: parsed.dryRun,
            confirmed: false,
            outcome: "success",
          });

          const activeProvider = getVercelProvider(provider);
          const result = await handleVercelValidateStaging(activeProvider, parsed);
          return jsonResult(result, `Validación staging: ${parsed.project}`);
        },
      );
    },
  );
}
