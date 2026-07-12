import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { VercelProvider } from "../../providers/vercel/index.js";
import { vercelProvider } from "../../providers/vercel/index.js";
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
  dryRun: dryRunSchema,
};

export async function handleVercelPrepareStaging(
  provider: VercelProvider,
  input: { project: string; dryRun: boolean },
) {
  if (isDryRunPreview(input)) {
    return {
      dryRun: true,
      project: input.project,
      wouldCheck: [
        "project_exists",
        "environment_variables",
        "preview_vs_production_diff",
        "domains",
        "aliases",
      ],
      note: "No se realizará ningún deploy.",
    };
  }

  const project = await provider.projects.findOne(input.project);
  const staging = await provider.prepareStaging(project.name);
  const domains = await provider.domains.list(project.name, { target: "preview" });
  const productionDomains = await provider.domains.list(project.name, { production: true });
  const aliases = await provider.projects.getAliases(project.name);

  const envIssues = [
    ...staging.envDiff.onlyInSource.map((env) => ({
      type: "missing_in_production" as const,
      key: env.key,
      message: `Variable "${env.key}" existe en preview pero no en production`,
    })),
    ...staging.envDiff.changed.map(({ key }) => ({
      type: "value_mismatch" as const,
      key,
      message: `Variable "${key}" difiere entre preview y production`,
    })),
  ];

  const onlyInPreview = staging.envDiff.onlyInSource;
  const onlyInProduction = staging.envDiff.onlyInTarget;

  const domainDiff = {
    previewOnly: domains
      .map((d) => d.name)
      .filter((name) => !productionDomains.some((pd) => pd.name === name)),
    productionOnly: productionDomains
      .map((d) => d.name)
      .filter((name) => !domains.some((pd) => pd.name === name)),
    unverified: domains.filter((d) => !d.verified).map((d) => d.name),
  };

  const ready =
    envIssues.length === 0 &&
    domainDiff.unverified.length === 0 &&
    staging.previewDeployment !== null;

  return {
    project: {
      id: project.id,
      name: project.name,
      framework: project.framework ?? null,
      verified: true,
    },
    deployments: {
      preview: staging.previewDeployment ? summarizeDeployment(staging.previewDeployment) : null,
      production: staging.productionDeployment
        ? summarizeDeployment(staging.productionDeployment)
        : null,
    },
    environment: {
      differences: {
        onlyInPreview: onlyInPreview.map((e) => e.key),
        onlyInProduction: onlyInProduction.map((e) => e.key),
        changed: staging.envDiff.changed.map((c) => c.key),
        equal: staging.envDiff.equal.map((e) => e.key),
      },
      issues: envIssues,
    },
    domains: {
      preview: domains.map((d) => ({ name: d.name, verified: d.verified ?? false })),
      production: productionDomains.map((d) => ({
        name: d.name,
        verified: d.verified ?? false,
      })),
      diff: domainDiff,
    },
    aliases,
    stagingReady: ready,
    recommendations: buildStagingRecommendations({
      envIssues,
      domainDiff,
      hasPreview: staging.previewDeployment !== null,
    }),
    note: "Preparación completada. No se realizó ningún deploy.",
  };
}

function buildStagingRecommendations(params: {
  envIssues: Array<{ type: string; key: string; message: string }>;
  domainDiff: { unverified: string[] };
  hasPreview: boolean;
}): string[] {
  const recommendations: string[] = [];

  if (!params.hasPreview) {
    recommendations.push("No hay deployment de preview. Ejecuta un deploy a preview primero.");
  }

  if (params.envIssues.length > 0) {
    recommendations.push("Sincroniza variables de entorno entre preview y production.");
  }

  if (params.domainDiff.unverified.length > 0) {
    recommendations.push(
      `Verifica dominios pendientes: ${params.domainDiff.unverified.join(", ")}`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Staging listo para validación con vercel_validate_staging.");
  }

  return recommendations;
}

export function registerVercelPrepareStagingTool(
  server: McpServer,
  provider: VercelProvider = vercelProvider,
): void {
  server.registerTool(
    "vercel_prepare_staging",
    {
      title: "Vercel Prepare Staging",
      description:
        "Prepara y audita el entorno de staging: verifica proyecto, compara variables preview vs production, dominios y aliases. No despliega.",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);

      return withAudit(
        {
          tool: "vercel_prepare_staging",
          action: "prepare_staging",
          project: parsed.project,
          dryRun: parsed.dryRun,
          confirmed: false,
        },
        async () => {
          audit({
            tool: "vercel_prepare_staging",
            action: "start",
            project: parsed.project,
            dryRun: parsed.dryRun,
            confirmed: false,
            outcome: "success",
          });

          const activeProvider = getVercelProvider(provider);
          const result = await handleVercelPrepareStaging(activeProvider, parsed);
          return jsonResult(result, `Staging preparado: ${parsed.project}`);
        },
      );
    },
  );
}
