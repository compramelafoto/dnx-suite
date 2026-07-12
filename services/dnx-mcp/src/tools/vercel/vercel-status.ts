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
  optionalProjectSchema,
  withAudit,
} from "../shared/index.js";
import { getVercelProvider, summarizeDeployment } from "./context.js";

const inputSchema = {
  project: optionalProjectSchema,
  dryRun: dryRunSchema,
};

export async function handleVercelStatus(
  provider: VercelProvider,
  input: { project?: string | undefined; dryRun: boolean },
) {
  if (isDryRunPreview(input)) {
    return {
      dryRun: true,
      preview: {
        wouldFetch: ["user", "team", "projects", "deployments", "domains", "health"],
        project: input.project ?? "all",
      },
    };
  }

  const user = await provider.auth.getUser();
  const teamScope = provider.auth.getActiveTeamScope();
  const teams = await provider.auth.listTeams();

  const activeTeam =
    teamScope.teamId !== undefined
      ? (teams.find((team) => team.id === teamScope.teamId) ?? null)
      : (teams[0] ?? null);

  const projects = input.project
    ? [await provider.projects.findOne(input.project)]
    : await provider.projects.list({ limit: 50 });

  const projectStatuses = await Promise.all(
    projects.map(async (project) => {
      const [production, preview, domains, aliases] = await Promise.all([
        provider.helpers.getProductionDeployment(project.name),
        provider.helpers.getPreviewDeployment(project.name),
        provider.domains.list(project.name),
        provider.projects.getAliases(project.name),
      ]);

      const lastDeploy = preview ?? production;
      const health = lastDeploy ? provider.getDeploymentHealth(lastDeploy) : "unknown";
      const build = lastDeploy ? extractBuildInfo(lastDeploy) : null;

      return {
        id: project.id,
        name: project.name,
        framework: project.framework ?? null,
        production: production ? summarizeDeployment(production) : null,
        preview: preview ? summarizeDeployment(preview) : null,
        domains: domains.map((domain) => ({
          name: domain.name,
          verified: domain.verified ?? false,
        })),
        aliases,
        lastDeploy: lastDeploy ? summarizeDeployment(lastDeploy) : null,
        status: lastDeploy?.readyState ?? lastDeploy?.state ?? "no_deployments",
        health,
        build,
      };
    }),
  );

  return {
    authenticatedUser: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      username: user.username ?? null,
    },
    team: activeTeam
      ? { id: activeTeam.id, slug: activeTeam.slug, name: activeTeam.name ?? null }
      : null,
    teamScope,
    projects: projectStatuses,
    summary: {
      totalProjects: projectStatuses.length,
      healthy: projectStatuses.filter((p) => p.health === "healthy").length,
      building: projectStatuses.filter((p) => p.health === "building").length,
      failed: projectStatuses.filter((p) => p.health === "failed").length,
    },
  };
}

export function registerVercelStatusTool(
  server: McpServer,
  provider: VercelProvider = vercelProvider,
): void {
  server.registerTool(
    "vercel_status",
    {
      title: "Vercel Status",
      description:
        "Panorama inteligente de la cuenta Vercel: usuario, team, proyectos, deployments de producción/preview, dominios, último deploy, estado y salud.",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);

      return withAudit(
        {
          tool: "vercel_status",
          action: "inspect_status",
          ...(parsed.project ? { project: parsed.project } : {}),
          dryRun: parsed.dryRun,
          confirmed: false,
        },
        async () => {
          audit({
            tool: "vercel_status",
            action: "start",
            dryRun: parsed.dryRun,
            confirmed: false,
            outcome: "success",
            ...(parsed.project ? { project: parsed.project } : {}),
          });

          const activeProvider = getVercelProvider(provider);
          const result = await handleVercelStatus(activeProvider, parsed);
          return jsonResult(result, "Estado de Vercel");
        },
      );
    },
  );
}
