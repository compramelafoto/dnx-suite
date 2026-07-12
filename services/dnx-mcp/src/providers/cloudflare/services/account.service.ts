import type { CloudflareHttpClient } from "../client/index.js";
import {
  cloudflareAccountHealthSchema,
  cloudflareAccountSchema,
  cloudflareTokenVerifySchema,
  parseCloudflareEnvelope,
  type CloudflareAccount,
  type CloudflareAccountHealth,
  type CloudflareTokenVerify,
} from "../types/index.js";
import { CloudflareApiError } from "../errors.js";

export class AccountService {
  constructor(private readonly client: CloudflareHttpClient) {}

  async verifyToken(): Promise<CloudflareTokenVerify> {
    const body = await this.client.get<unknown>("/user/tokens/verify");
    try {
      return parseCloudflareEnvelope(body, cloudflareTokenVerifySchema);
    } catch (error) {
      throw new CloudflareApiError(
        400,
        undefined,
        error instanceof Error ? error.message : "Token verify falló",
        body,
      );
    }
  }

  async getAccount(): Promise<CloudflareAccount> {
    const body = await this.client.get<unknown>(`/accounts/${this.client.accountId}`);
    try {
      return parseCloudflareEnvelope(body, cloudflareAccountSchema);
    } catch (error) {
      throw new CloudflareApiError(
        400,
        undefined,
        error instanceof Error ? error.message : "getAccount falló",
        body,
      );
    }
  }

  async getAccountHealth(): Promise<CloudflareAccountHealth> {
    const blockers: string[] = [];
    const warnings: string[] = [];
    let tokenActive = false;
    let accountAccessible = false;
    let accountName: string | null = null;

    try {
      const token = await this.verifyToken();
      tokenActive = token.status === "active";
      if (!tokenActive) {
        blockers.push(`Token Cloudflare no activo (status=${token.status})`);
      }
    } catch {
      blockers.push("No se pudo verificar el token de Cloudflare");
    }

    try {
      const account = await this.getAccount();
      accountAccessible = true;
      accountName = account.name;
    } catch {
      blockers.push("No se pudo acceder a la cuenta de Cloudflare");
    }

    const riskLevel = blockers.length > 0 ? "high" : warnings.length > 0 ? "medium" : "low";

    return cloudflareAccountHealthSchema.parse({
      configured: true,
      tokenActive,
      accountAccessible,
      accountId: this.client.accountId,
      accountName,
      riskLevel,
      blockers,
      warnings,
    });
  }
}
