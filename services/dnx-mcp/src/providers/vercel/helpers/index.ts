import type { DeploymentsService } from "../services/deployments.service.js";
import type { EnvVarsService } from "../services/env-vars.service.js";
import type { ProjectsService } from "../services/projects.service.js";
import { VercelDeploymentTimeoutError, VercelNotFoundError } from "../errors.js";
import {
  extractBuildInfo,
  type DeploymentHealth,
  type DeploymentTarget,
  type VercelDeployment,
  type VercelEnvVar,
} from "../types/index.js";

export interface WaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  terminalStates?: Array<"READY" | "ERROR" | "CANCELED">;
}

export interface EnvComparisonResult {
  onlyInSource: VercelEnvVar[];
  onlyInTarget: VercelEnvVar[];
  changed: Array<{
    key: string;
    source: VercelEnvVar;
    target: VercelEnvVar;
  }>;
  equal: VercelEnvVar[];
}

export interface StagingPreparationResult {
  project: string;
  previewDeployment: VercelDeployment | null;
  productionDeployment: VercelDeployment | null;
  envDiff: EnvComparisonResult;
  domains: string[];
}

export class VercelHelpers {
  constructor(
    private readonly projects: ProjectsService,
    private readonly deployments: DeploymentsService,
    private readonly envVars: EnvVarsService,
  ) {}

  async getProductionDeployment(projectIdOrName: string): Promise<VercelDeployment | null> {
    return this.deployments.getCurrent(projectIdOrName, "production");
  }

  async getPreviewDeployment(projectIdOrName: string): Promise<VercelDeployment | null> {
    return this.deployments.getCurrent(projectIdOrName, "preview");
  }

  async prepareStaging(projectIdOrName: string): Promise<StagingPreparationResult> {
    const [previewDeployment, productionDeployment, domains] = await Promise.all([
      this.getPreviewDeployment(projectIdOrName),
      this.getProductionDeployment(projectIdOrName),
      this.projects.getAliases(projectIdOrName),
    ]);

    const envDiff = await this.compareEnvironmentVariables(
      projectIdOrName,
      projectIdOrName,
      "preview",
      "production",
    );

    return {
      project: projectIdOrName,
      previewDeployment,
      productionDeployment,
      envDiff,
      domains,
    };
  }

  async compareEnvironmentVariables(
    sourceProject: string,
    targetProject: string,
    sourceTarget: DeploymentTarget = "preview",
    targetTarget: DeploymentTarget = "production",
  ): Promise<EnvComparisonResult> {
    const [sourceEnvs, targetEnvs] = await Promise.all([
      this.envVars.list(sourceProject),
      this.envVars.list(targetProject),
    ]);

    const filterByTarget = (envs: VercelEnvVar[], target: DeploymentTarget): VercelEnvVar[] =>
      envs.filter((env) => env.target?.includes(target));

    const sourceFiltered = filterByTarget(sourceEnvs, sourceTarget);
    const targetFiltered = filterByTarget(targetEnvs, targetTarget);

    const sourceMap = new Map(sourceFiltered.map((env) => [env.key, env]));
    const targetMap = new Map(targetFiltered.map((env) => [env.key, env]));

    const onlyInSource: VercelEnvVar[] = [];
    const onlyInTarget: VercelEnvVar[] = [];
    const changed: EnvComparisonResult["changed"] = [];
    const equal: VercelEnvVar[] = [];

    for (const [key, sourceEnv] of sourceMap) {
      const targetEnv = targetMap.get(key);
      if (!targetEnv) {
        onlyInSource.push(sourceEnv);
        continue;
      }

      if (this.envValuesDiffer(sourceEnv, targetEnv)) {
        changed.push({ key, source: sourceEnv, target: targetEnv });
      } else {
        equal.push(sourceEnv);
      }
    }

    for (const [key, targetEnv] of targetMap) {
      if (!sourceMap.has(key)) {
        onlyInTarget.push(targetEnv);
      }
    }

    return { onlyInSource, onlyInTarget, changed, equal };
  }

  getDeploymentHealth(deployment: VercelDeployment): DeploymentHealth {
    const state = deployment.readyState ?? deployment.state;

    switch (state) {
      case "READY":
        return "healthy";
      case "BUILDING":
      case "INITIALIZING":
      case "QUEUED":
        return "building";
      case "ERROR":
        return "failed";
      case "CANCELED":
        return "canceled";
      default:
        return "unknown";
    }
  }

  async waitUntilDeploymentReady(
    deploymentId: string,
    options: WaitOptions = {},
  ): Promise<VercelDeployment> {
    const timeoutMs = options.timeoutMs ?? 600_000;
    const pollIntervalMs = options.pollIntervalMs ?? 5_000;
    const terminalStates = options.terminalStates ?? ["READY", "ERROR", "CANCELED"];
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const deployment = await this.deployments.get(deploymentId);
      const state = deployment.readyState ?? deployment.state;

      if (state && terminalStates.includes(state as "READY" | "ERROR" | "CANCELED")) {
        return deployment;
      }

      await sleep(pollIntervalMs);
    }

    throw new VercelDeploymentTimeoutError(deploymentId, timeoutMs);
  }

  async deployAndWait(
    projectIdOrName: string,
    options: {
      target?: DeploymentTarget;
      redeployFrom?: string;
      timeoutMs?: number;
      pollIntervalMs?: number;
    } = {},
  ): Promise<VercelDeployment> {
    let deployment: VercelDeployment;

    if (options.redeployFrom) {
      deployment = await this.deployments.redeploy({
        deploymentId: options.redeployFrom,
        ...(options.target ? { target: options.target } : {}),
      });
    } else {
      const current = await this.deployments.getCurrent(
        projectIdOrName,
        options.target ?? "production",
      );

      if (!current) {
        throw new VercelNotFoundError("Deployment actual", projectIdOrName);
      }

      deployment = await this.deployments.redeploy({
        deploymentId: current.id,
        ...(options.target ? { target: options.target } : {}),
      });
    }

    return this.waitUntilDeploymentReady(deployment.id, {
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.pollIntervalMs !== undefined ? { pollIntervalMs: options.pollIntervalMs } : {}),
    });
  }

  async rollbackToPreviousDeployment(
    projectIdOrName: string,
    target: DeploymentTarget = "production",
  ): Promise<VercelDeployment> {
    const deployments = await this.deployments.list({
      projectId: projectIdOrName,
      target,
      state: "READY",
      limit: 2,
    });

    const previous = deployments[1];
    if (!previous) {
      throw new VercelNotFoundError("Deployment anterior", projectIdOrName);
    }

    return this.deployments.redeploy({ deploymentId: previous.id, target });
  }

  async getBuildInfo(deploymentId: string) {
    const deployment = await this.deployments.get(deploymentId);
    return extractBuildInfo(deployment);
  }

  private envValuesDiffer(a: VercelEnvVar, b: VercelEnvVar): boolean {
    if (a.type !== b.type) {
      return true;
    }

    if (a.value !== undefined && b.value !== undefined) {
      return a.value !== b.value;
    }

    return JSON.stringify(a.target) !== JSON.stringify(b.target);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
