import type { VercelHttpClient } from "../client/index.js";
import { VercelNotFoundError } from "../errors.js";
import {
  parseVercelEnvVar,
  parseVercelEnvVars,
  type CreateEnvVarInput,
  type UpdateEnvVarInput,
  type VercelEnvVar,
} from "../types/index.js";

export class EnvVarsService {
  constructor(private readonly client: VercelHttpClient) {}

  async list(projectIdOrName: string): Promise<VercelEnvVar[]> {
    const response = await this.client.get<unknown>(
      `/v10/projects/${encodeURIComponent(projectIdOrName)}/env`,
    );
    return parseVercelEnvVars(response);
  }

  async get(
    projectIdOrName: string,
    envId: string,
    options: { decrypt?: boolean } = {},
  ): Promise<VercelEnvVar> {
    const response = await this.client.get<unknown>(
      `/v10/projects/${encodeURIComponent(projectIdOrName)}/env/${envId}`,
      {
        query: {
          decrypt: options.decrypt,
        },
      },
    );
    return parseVercelEnvVar(response);
  }

  async getByKey(
    projectIdOrName: string,
    key: string,
    options: { decrypt?: boolean } = {},
  ): Promise<VercelEnvVar> {
    const envs = await this.list(projectIdOrName);
    const match = envs.find((env) => env.key === key);

    if (!match?.id) {
      throw new VercelNotFoundError("Variable de entorno", key);
    }

    if (options.decrypt) {
      return this.get(projectIdOrName, match.id, { decrypt: true });
    }

    return match;
  }

  async create(projectIdOrName: string, input: CreateEnvVarInput): Promise<VercelEnvVar> {
    const response = await this.client.post<unknown>(
      `/v10/projects/${encodeURIComponent(projectIdOrName)}/env`,
      {
        body: {
          key: input.key,
          value: input.value,
          type: input.type ?? "encrypted",
          target: input.target,
          gitBranch: input.gitBranch,
        },
      },
    );

    return parseVercelEnvVar(response);
  }

  async update(
    projectIdOrName: string,
    envId: string,
    input: UpdateEnvVarInput,
  ): Promise<VercelEnvVar> {
    const response = await this.client.patch<unknown>(
      `/v10/projects/${encodeURIComponent(projectIdOrName)}/env/${envId}`,
      {
        body: input,
      },
    );

    return parseVercelEnvVar(response);
  }

  async delete(projectIdOrName: string, envId: string): Promise<void> {
    await this.client.delete(`/v9/projects/${encodeURIComponent(projectIdOrName)}/env/${envId}`);
  }

  async deleteByKey(projectIdOrName: string, key: string): Promise<void> {
    const env = await this.getByKey(projectIdOrName, key);
    if (!env.id) {
      throw new VercelNotFoundError("Variable de entorno", key);
    }
    await this.delete(projectIdOrName, env.id);
  }
}
