import { loadEnv } from "../../config/index.js";
import { ProviderNotConfiguredError } from "../../utils/errors.js";
import type { Provider } from "../../types/provider.js";
import { VercelHttpClient } from "./client/index.js";
import { defaultVercelConfig, vercelConfigSchema, type VercelConfig } from "./config.js";
import { VercelHelpers } from "./helpers/index.js";
import {
  AuthService,
  DeploymentsService,
  DomainsService,
  EnvVarsService,
  LogsService,
  ProjectsService,
} from "./services/index.js";

export interface VercelProviderOptions {
  config?: Partial<VercelConfig>;
  fetchImpl?: typeof fetch;
}

/**
 * Provider empresarial de Vercel.
 *
 * Expone servicios desacoplados por dominio y helpers de alto nivel
 * para operaciones comunes de infraestructura.
 */
export class VercelProvider implements Provider {
  readonly name = "vercel" as const;

  readonly auth: AuthService;
  readonly projects: ProjectsService;
  readonly deployments: DeploymentsService;
  readonly envVars: EnvVarsService;
  readonly domains: DomainsService;
  readonly logs: LogsService;
  readonly helpers: VercelHelpers;

  private readonly config: VercelConfig;
  private readonly client: VercelHttpClient;

  constructor(options: VercelProviderOptions = {}) {
    this.config = resolveVercelConfig(options.config);
    this.client = new VercelHttpClient({
      config: this.config,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });

    this.auth = new AuthService(this.client);
    this.projects = new ProjectsService(this.client);
    this.deployments = new DeploymentsService(this.client);
    this.envVars = new EnvVarsService(this.client);
    this.domains = new DomainsService(this.client);
    this.logs = new LogsService(this.client);
    this.helpers = new VercelHelpers(this.projects, this.deployments, this.envVars);
  }

  isConfigured(): boolean {
    return this.config.token.length > 0;
  }

  getConfig(): Readonly<VercelConfig> {
    return this.config;
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.name);
    }
  }

  // --- Atajos de alto nivel (delegan en helpers) ---

  getProductionDeployment(projectIdOrName: string) {
    this.assertConfigured();
    return this.helpers.getProductionDeployment(projectIdOrName);
  }

  prepareStaging(projectIdOrName: string) {
    this.assertConfigured();
    return this.helpers.prepareStaging(projectIdOrName);
  }

  compareEnvironmentVariables(
    sourceProject: string,
    targetProject: string,
    sourceTarget?: "production" | "preview" | "development",
    targetTarget?: "production" | "preview" | "development",
  ) {
    this.assertConfigured();
    return this.helpers.compareEnvironmentVariables(
      sourceProject,
      targetProject,
      sourceTarget,
      targetTarget,
    );
  }

  getDeploymentHealth(deployment: Parameters<VercelHelpers["getDeploymentHealth"]>[0]) {
    return this.helpers.getDeploymentHealth(deployment);
  }

  waitUntilDeploymentReady(
    deploymentId: string,
    options?: Parameters<VercelHelpers["waitUntilDeploymentReady"]>[1],
  ) {
    this.assertConfigured();
    return this.helpers.waitUntilDeploymentReady(deploymentId, options);
  }

  deployAndWait(projectIdOrName: string, options?: Parameters<VercelHelpers["deployAndWait"]>[1]) {
    this.assertConfigured();
    return this.helpers.deployAndWait(projectIdOrName, options);
  }

  rollbackToPreviousDeployment(
    projectIdOrName: string,
    target?: "production" | "preview" | "development",
  ) {
    this.assertConfigured();
    return this.helpers.rollbackToPreviousDeployment(projectIdOrName, target);
  }
}

export function resolveVercelConfig(overrides: Partial<VercelConfig> = {}): VercelConfig {
  const env = loadEnv();

  return vercelConfigSchema.parse({
    ...defaultVercelConfig,
    token: overrides.token ?? env.VERCEL_TOKEN ?? "",
    teamId: overrides.teamId ?? env.VERCEL_TEAM_ID,
    teamSlug: overrides.teamSlug ?? env.VERCEL_TEAM_SLUG,
    ...overrides,
  });
}

export function createVercelProvider(options: VercelProviderOptions = {}): VercelProvider {
  return new VercelProvider(options);
}

export const vercelProvider = createVercelProvider();
