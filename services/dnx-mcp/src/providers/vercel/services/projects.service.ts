import type { VercelHttpClient } from "../client/index.js";
import { VercelNotFoundError } from "../errors.js";
import {
  parseVercelDeploymentAliases,
  parseVercelProject,
  parseVercelProjectDomains,
  parseVercelProjects,
  type ListOptions,
  type VercelProject,
  type VercelProjectDomain,
} from "../types/index.js";

export interface ListProjectsOptions extends ListOptions {
  search?: string;
}

export class ProjectsService {
  constructor(private readonly client: VercelHttpClient) {}

  async list(options: ListProjectsOptions = {}): Promise<VercelProject[]> {
    const response = await this.client.get<unknown>("/v9/projects", {
      query: {
        limit: options.limit,
        since: options.since,
        until: options.until,
        search: options.search,
      },
    });

    const parsed = parseVercelProjects(response);
    return parsed;
  }

  async get(idOrName: string): Promise<VercelProject> {
    const response = await this.client.get<unknown>(`/v9/projects/${encodeURIComponent(idOrName)}`);
    return parseVercelProject(response);
  }

  async find(query: string): Promise<VercelProject[]> {
    return this.list({ search: query, limit: 100 });
  }

  async findOne(query: string): Promise<VercelProject> {
    const projects = await this.find(query);
    const exact = projects.find(
      (project) => project.id === query || project.name.toLowerCase() === query.toLowerCase(),
    );

    if (exact) {
      return exact;
    }

    if (projects.length === 1) {
      const project = projects[0];
      if (project) {
        return project;
      }
    }

    if (projects.length === 0) {
      throw new VercelNotFoundError("Proyecto", query);
    }

    throw new VercelNotFoundError(
      "Proyecto",
      `${query} (múltiples coincidencias: ${projects.map((p) => p.name).join(", ")})`,
    );
  }

  async listDomains(
    idOrName: string,
    options: {
      production?: boolean;
      target?: "production" | "preview";
      verified?: boolean;
      limit?: number;
    } = {},
  ): Promise<VercelProjectDomain[]> {
    const response = await this.client.get<unknown>(
      `/v9/projects/${encodeURIComponent(idOrName)}/domains`,
      {
        query: {
          production: options.production,
          target: options.target,
          verified: options.verified,
          limit: options.limit,
        },
      },
    );

    const parsed = parseVercelProjectDomains(response);
    return parsed;
  }

  async getAliases(idOrName: string): Promise<string[]> {
    const project = await this.get(idOrName);
    const aliasDomains = project.alias?.map((entry) => entry.domain) ?? [];
    const deploymentAliases = await this.getDeploymentAliasesFromProject(project);
    return [...new Set([...aliasDomains, ...deploymentAliases])];
  }

  private async getDeploymentAliasesFromProject(project: VercelProject): Promise<string[]> {
    const deploymentId = project.latestDeployments?.[0]?.id;
    if (!deploymentId) {
      return [];
    }

    try {
      const response = await this.client.get<unknown>(`/v2/deployments/${deploymentId}/aliases`);
      return parseVercelDeploymentAliases(response);
    } catch {
      return [];
    }
  }
}
