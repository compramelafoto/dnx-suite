import type { VercelHttpClient } from "../client/index.js";
import { VercelNotFoundError } from "../errors.js";
import {
  parseVercelDeployment,
  parseVercelDeploymentAliases,
  parseVercelDeployments,
  type DeploymentState,
  type DeploymentTarget,
  type ListOptions,
  type VercelDeployment,
} from "../types/index.js";

export interface ListDeploymentsOptions extends ListOptions {
  projectId?: string;
  projectName?: string;
  target?: DeploymentTarget;
  state?: DeploymentState;
  branch?: string;
  sha?: string;
}

export interface RedeployOptions {
  deploymentId: string;
  target?: DeploymentTarget;
  teamId?: string;
}

export interface CreateDeploymentOptions {
  name: string;
  project?: string;
  target?: DeploymentTarget;
  gitSource?: {
    type: "github" | "gitlab" | "bitbucket";
    repoId?: string | number;
    ref?: string;
    sha?: string;
  };
  deploymentId?: string;
}

export class DeploymentsService {
  constructor(private readonly client: VercelHttpClient) {}

  async list(options: ListDeploymentsOptions = {}): Promise<VercelDeployment[]> {
    const response = await this.client.get<unknown>("/v6/deployments", {
      query: {
        limit: options.limit,
        since: options.since,
        until: options.until,
        projectId: options.projectId,
        target: options.target,
        state: options.state,
        branch: options.branch,
        sha: options.sha,
      },
    });

    return parseVercelDeployments(response);
  }

  async get(deploymentIdOrUrl: string): Promise<VercelDeployment> {
    const response = await this.client.get<unknown>(
      `/v13/deployments/${encodeURIComponent(deploymentIdOrUrl)}`,
    );
    return parseVercelDeployment(response);
  }

  async getCurrent(
    projectIdOrName: string,
    target: DeploymentTarget = "production",
  ): Promise<VercelDeployment | null> {
    const projectResponse = await this.client.get<{ targets?: Record<string, { id?: string }> }>(
      `/v9/projects/${encodeURIComponent(projectIdOrName)}`,
    );

    const targetDeploymentId = projectResponse.targets?.[target]?.id;
    if (targetDeploymentId) {
      return this.get(targetDeploymentId);
    }

    const deployments = await this.list({
      projectId: projectIdOrName,
      target,
      limit: 1,
      state: "READY",
    });

    return deployments[0] ?? null;
  }

  async getLatestSuccessful(
    projectIdOrName: string,
    target?: DeploymentTarget,
  ): Promise<VercelDeployment | null> {
    const deployments = await this.list({
      projectId: projectIdOrName,
      ...(target ? { target } : {}),
      state: "READY",
      limit: 1,
    });
    return deployments[0] ?? null;
  }

  async getLatestFailed(
    projectIdOrName: string,
    target?: DeploymentTarget,
  ): Promise<VercelDeployment | null> {
    const deployments = await this.list({
      projectId: projectIdOrName,
      ...(target ? { target } : {}),
      state: "ERROR",
      limit: 1,
    });
    return deployments[0] ?? null;
  }

  async redeploy(options: RedeployOptions): Promise<VercelDeployment> {
    const response = await this.client.post<unknown>(
      `/v13/deployments/${options.deploymentId}/redeploy`,
      {
        body: {
          ...(options.target ? { target: options.target } : {}),
        },
        query: options.teamId ? { teamId: options.teamId } : {},
      },
    );

    return parseVercelDeployment(response);
  }

  async create(options: CreateDeploymentOptions): Promise<VercelDeployment> {
    const response = await this.client.post<unknown>("/v13/deployments", {
      body: {
        name: options.name,
        project: options.project,
        target: options.target,
        gitSource: options.gitSource,
        deploymentId: options.deploymentId,
      },
    });

    return parseVercelDeployment(response);
  }

  async cancel(deploymentId: string): Promise<void> {
    await this.client.patch(`/v12/deployments/${deploymentId}/cancel`);
  }

  async getAliases(deploymentId: string): Promise<string[]> {
    const response = await this.client.get<unknown>(`/v2/deployments/${deploymentId}/aliases`);
    const parsed = parseVercelDeploymentAliases(response);
    return parsed;
  }

  async findById(deploymentId: string): Promise<VercelDeployment> {
    try {
      return await this.get(deploymentId);
    } catch (error) {
      if (error instanceof VercelNotFoundError) {
        throw new VercelNotFoundError("Deployment", deploymentId);
      }
      throw error;
    }
  }
}
