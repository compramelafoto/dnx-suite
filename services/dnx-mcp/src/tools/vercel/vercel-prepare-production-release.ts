import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { VercelProvider } from "../../providers/vercel/index.js";
import { vercelProvider } from "../../providers/vercel/index.js";
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
  dryRun: dryRunSchema,
};

type RiskLevel = "low" | "medium" | "high";

interface Risk {
  level: RiskLevel;
  message: string;
}

export async function handleVercelPrepareProductionRelease(
  provider: VercelProvider,
  input: { project: string; dryRun: boolean },
) {
  if (isDryRunPreview(input)) {
    return {
      dryRun: true,
      project: input.project,
      wouldGenerate: [
        "release_plan",
        "risk_assessment",
        "env_diff",
        "domain_diff",
        "candidate_deployment",
        "rollback_option",
        "checklist",
      ],
      note: "No se realizará ningún deploy.",
    };
  }

  const project = await provider.projects.findOne(input.project);

  const [
    candidateDeployment,
    productionDeployment,
    successfulDeployments,
    envDiff,
    domains,
    aliases,
  ] = await Promise.all([
    provider.helpers.getPreviewDeployment(project.name),
    provider.helpers.getProductionDeployment(project.name),
    provider.deployments.list({ projectId: project.id, state: "READY", limit: 5 }),
    provider.compareEnvironmentVariables(project.name, project.name, "preview", "production"),
    provider.domains.list(project.name),
    provider.projects.getAliases(project.name),
  ]);

  const rollbackDeployment = successfulDeployments[1] ?? null;
  const risks: Risk[] = [];

  if (!candidateDeployment) {
    risks.push({ level: "high", message: "No hay deployment candidato en preview." });
  } else if (provider.getDeploymentHealth(candidateDeployment) !== "healthy") {
    risks.push({
      level: "high",
      message: "El deployment candidato no está en estado healthy.",
    });
  }

  if (envDiff.changed.length > 0) {
    risks.push({
      level: "medium",
      message: `${String(envDiff.changed.length)} variable(s) difieren entre preview y production.`,
    });
  }

  if (envDiff.onlyInSource.length > 0) {
    risks.push({
      level: "medium",
      message: `${String(envDiff.onlyInSource.length)} variable(s) solo existen en preview.`,
    });
  }

  const unverifiedDomains = domains.filter((d) => !d.verified);
  if (unverifiedDomains.length > 0) {
    risks.push({
      level: "high",
      message: `Dominios sin verificar: ${unverifiedDomains.map((d) => d.name).join(", ")}`,
    });
  }

  if (!rollbackDeployment) {
    risks.push({
      level: "medium",
      message: "No hay deployment anterior disponible para rollback automático.",
    });
  }

  const checklist = [
    {
      item: "Staging validado",
      status: candidateDeployment ? "pending" : "failed",
      notes: "Ejecutar vercel_validate_staging antes del release.",
    },
    {
      item: "Deployment candidato identificado",
      status: candidateDeployment ? "ready" : "failed",
      notes: candidateDeployment?.id ?? "N/A",
    },
    {
      item: "Variables de entorno alineadas",
      status:
        envDiff.changed.length === 0 && envDiff.onlyInSource.length === 0 ? "ready" : "attention",
      notes: `${String(envDiff.changed.length)} cambios, ${String(envDiff.onlyInSource.length)} nuevas en preview.`,
    },
    {
      item: "Dominios verificados",
      status: unverifiedDomains.length === 0 ? "ready" : "failed",
      notes: `${String(unverifiedDomains.length)} pendiente(s).`,
    },
    {
      item: "Rollback disponible",
      status: rollbackDeployment ? "ready" : "attention",
      notes: rollbackDeployment?.id ?? "Sin deployment anterior.",
    },
    {
      item: "Confirmación de deploy",
      status: "pending",
      notes: "Requerida en vercel_deploy_release con confirm: true.",
    },
  ];

  const readyForRelease =
    risks.filter((r) => r.level === "high").length === 0 && candidateDeployment !== null;

  return {
    project: { id: project.id, name: project.name },
    releasePlan: {
      candidateDeployment: candidateDeployment
        ? {
            ...summarizeDeployment(candidateDeployment),
            build: extractBuildInfo(candidateDeployment),
          }
        : null,
      currentProduction: productionDeployment ? summarizeDeployment(productionDeployment) : null,
      rollbackAvailable: rollbackDeployment ? summarizeDeployment(rollbackDeployment) : null,
    },
    risks,
    differences: {
      env: {
        onlyInPreview: envDiff.onlyInSource.map((e) => e.key),
        onlyInProduction: envDiff.onlyInTarget.map((e) => e.key),
        changed: envDiff.changed.map((c) => ({
          key: c.key,
          previewType: c.source.type,
          productionType: c.target.type,
        })),
      },
      domains: domains.map((d) => ({
        name: d.name,
        verified: d.verified ?? false,
      })),
      aliases,
    },
    checklist,
    readyForRelease,
    note: "Plan de release generado. No se realizó ningún deploy.",
  };
}

export function registerVercelPrepareProductionReleaseTool(
  server: McpServer,
  provider: VercelProvider = vercelProvider,
): void {
  server.registerTool(
    "vercel_prepare_production_release",
    {
      title: "Vercel Prepare Production Release",
      description:
        "Genera un plan de salida a producción: riesgos, diferencias de envs/dominios, deployment candidato, rollback y checklist. No despliega.",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);

      return withAudit(
        {
          tool: "vercel_prepare_production_release",
          action: "prepare_production_release",
          project: parsed.project,
          dryRun: parsed.dryRun,
          confirmed: false,
        },
        async () => {
          audit({
            tool: "vercel_prepare_production_release",
            action: "start",
            project: parsed.project,
            dryRun: parsed.dryRun,
            confirmed: false,
            outcome: "success",
          });

          const activeProvider = getVercelProvider(provider);
          const result = await handleVercelPrepareProductionRelease(activeProvider, parsed);
          return jsonResult(result, `Plan de release: ${parsed.project}`);
        },
      );
    },
  );
}
