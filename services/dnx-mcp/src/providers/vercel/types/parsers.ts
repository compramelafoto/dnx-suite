import { z } from "zod";
import {
  vercelDeploymentAliasSchema,
  vercelDeploymentSchema,
  vercelDeploymentsResponseSchema,
  type VercelDeployment,
} from "./deployment.js";
import {
  vercelDomainConfigSchema,
  vercelProjectDomainSchema,
  vercelProjectDomainsResponseSchema,
  type VercelDomainVerification,
  type VercelProjectDomain,
} from "./domain.js";
import { vercelEnvVarSchema, vercelEnvVarsResponseSchema, type VercelEnvVar } from "./env.js";
import {
  vercelProjectSchema,
  vercelProjectsResponseSchema,
  type VercelProject,
} from "./project.js";
import {
  vercelTeamSchema,
  vercelTeamsResponseSchema,
  vercelUserSchema,
  type VercelTeam,
  type VercelUser,
} from "./auth.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapNested<T>(response: unknown, key: string, schema: z.ZodType<T>): T {
  if (isRecord(response) && key in response) {
    return schema.parse(response[key]);
  }
  return schema.parse(response);
}

export function parseVercelUser(response: unknown): VercelUser {
  return unwrapNested(response, "user", vercelUserSchema);
}

export function parseVercelTeam(response: unknown): VercelTeam {
  return unwrapNested(response, "team", vercelTeamSchema);
}

/**
 * GET /v2/teams devuelve `{ teams, pagination }` sin scope de team.
 * Con `slug` en query (team scope del cliente) devuelve un único team plano.
 */
export function parseVercelTeams(response: unknown): VercelTeam[] {
  if (isRecord(response) && Array.isArray(response.teams)) {
    return z.array(vercelTeamSchema).parse(response.teams);
  }

  if (isRecord(response) && typeof response.id === "string" && typeof response.slug === "string") {
    return [vercelTeamSchema.parse(response)];
  }

  return vercelTeamsResponseSchema.parse(response).teams;
}

export function parseVercelProjects(response: unknown): VercelProject[] {
  return vercelProjectsResponseSchema.parse(response).projects;
}

export function parseVercelProject(response: unknown): VercelProject {
  return unwrapNested(response, "project", vercelProjectSchema);
}

export function parseVercelDeployments(response: unknown): VercelDeployment[] {
  return vercelDeploymentsResponseSchema.parse(response).deployments;
}

export function parseVercelDeployment(response: unknown): VercelDeployment {
  return unwrapNested(response, "deployment", vercelDeploymentSchema);
}

export function parseVercelEnvVars(response: unknown): VercelEnvVar[] {
  return vercelEnvVarsResponseSchema.parse(response).envs;
}

export function parseVercelEnvVar(response: unknown): VercelEnvVar {
  return unwrapNested(response, "env", vercelEnvVarSchema);
}

export function parseVercelProjectDomains(response: unknown): VercelProjectDomain[] {
  return vercelProjectDomainsResponseSchema.parse(response).domains;
}

export function parseVercelProjectDomain(response: unknown): VercelProjectDomain {
  return unwrapNested(response, "domain", vercelProjectDomainSchema);
}

export function parseVercelDomainConfig(response: unknown): {
  configuredBy: string | null;
  misconfigured: boolean;
  acceptedChallenges: string[];
} {
  const parsed = vercelDomainConfigSchema.parse(response);
  return {
    configuredBy: parsed.configuredBy ?? null,
    misconfigured: parsed.misconfigured ?? false,
    acceptedChallenges: parsed.acceptedChallenges ?? [],
  };
}

/**
 * GET /v2/deployments/:id/aliases devuelve `{ aliases: [{ alias, uid, ... }] }`.
 * Algunas respuestas legacy usan `{ alias: string[] }`.
 */
export function parseVercelDeploymentAliases(response: unknown): string[] {
  if (isRecord(response) && Array.isArray(response.aliases)) {
    return response.aliases.map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (isRecord(entry) && typeof entry.alias === "string") {
        return entry.alias;
      }
      throw new Error("Formato de alias de deployment no reconocido");
    });
  }

  const parsed = vercelDeploymentAliasSchema.parse(response);
  return parsed.alias ?? [];
}

export type { VercelDomainVerification };
