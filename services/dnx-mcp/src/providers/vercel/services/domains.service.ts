import type { VercelHttpClient } from "../client/index.js";
import {
  parseVercelDomainConfig,
  parseVercelProjectDomain,
  parseVercelProjectDomains,
  type AddDomainInput,
  type VercelDomainVerification,
  type VercelProjectDomain,
} from "../types/index.js";

export class DomainsService {
  constructor(private readonly client: VercelHttpClient) {}

  async list(
    projectIdOrName: string,
    options: {
      production?: boolean;
      target?: "production" | "preview";
      verified?: boolean;
      limit?: number;
    } = {},
  ): Promise<VercelProjectDomain[]> {
    const response = await this.client.get<unknown>(
      `/v9/projects/${encodeURIComponent(projectIdOrName)}/domains`,
      {
        query: {
          production: options.production,
          target: options.target,
          verified: options.verified,
          limit: options.limit,
        },
      },
    );

    return parseVercelProjectDomains(response);
  }

  async add(projectIdOrName: string, input: AddDomainInput): Promise<VercelProjectDomain> {
    const response = await this.client.post<unknown>(
      `/v10/projects/${encodeURIComponent(projectIdOrName)}/domains`,
      {
        body: {
          name: input.name,
          gitBranch: input.gitBranch,
          redirect: input.redirect,
          redirectStatusCode: input.redirectStatusCode,
        },
      },
    );

    return parseVercelProjectDomain(response);
  }

  async verify(
    projectIdOrName: string,
    domain: string,
  ): Promise<{ verified: boolean; verification?: VercelDomainVerification[] }> {
    const response = await this.client.post<unknown>(
      `/v9/projects/${encodeURIComponent(projectIdOrName)}/domains/${encodeURIComponent(domain)}/verify`,
    );

    const parsed = parseVercelProjectDomain(response);
    return {
      verified: parsed.verified ?? false,
      ...(parsed.verification ? { verification: parsed.verification } : {}),
    };
  }

  async getConfig(domain: string): Promise<{
    configuredBy: string | null;
    misconfigured: boolean;
    acceptedChallenges: string[];
  }> {
    const response = await this.client.get<unknown>(
      `/v6/domains/${encodeURIComponent(domain)}/config`,
    );
    return parseVercelDomainConfig(response);
  }

  async getAliases(projectIdOrName: string): Promise<string[]> {
    const domains = await this.list(projectIdOrName);
    return domains.map((domain) => domain.name);
  }
}
