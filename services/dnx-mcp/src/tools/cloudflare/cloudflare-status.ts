import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import { cloudflareProvider } from "../../providers/cloudflare/index.js";
import { audit, isDryRunPreview, jsonResult, withAudit } from "../shared/index.js";
import { getCloudflareProvider } from "./context.js";
import { cfDryRunSchema } from "./schemas.js";

const inputSchema = {
  dryRun: cfDryRunSchema,
};

export async function handleCloudflareStatus(
  provider: CloudflareProvider,
  input: { dryRun: boolean },
) {
  if (isDryRunPreview(input)) {
    return {
      dryRun: true,
      preview: {
        wouldFetch: ["verifyToken", "getAccount", "getAccountHealth", "listBuckets"],
      },
    };
  }

  const [token, account, health, buckets] = await Promise.all([
    provider.verifyToken(),
    provider.getAccount(),
    provider.getAccountHealth(),
    provider.listBuckets().catch(() => []),
  ]);

  return {
    dryRun: false,
    token: { id: token.id, status: token.status },
    account: { id: account.id, name: account.name },
    health,
    buckets: buckets.map((b) => ({ name: b.name, creationDate: b.creationDate ?? null })),
    objectCredentialsConfigured: provider.hasObjectCredentials(),
    summary: {
      tokenActive: token.status === "active",
      bucketCount: buckets.length,
      riskLevel: health.riskLevel,
    },
  };
}

export function registerCloudflareStatusTool(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  server.registerTool(
    "cloudflare_status",
    {
      title: "Cloudflare Status",
      description:
        "Estado de cuenta Cloudflare: token, account health y listado de buckets R2 (solo lectura).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "cloudflare_status",
          action: "inspect_status",
          dryRun: parsed.dryRun,
          confirmed: false,
        },
        async () => {
          audit({
            tool: "cloudflare_status",
            action: "start",
            dryRun: parsed.dryRun,
            confirmed: false,
            outcome: "success",
          });
          const active = getCloudflareProvider(provider);
          const result = await handleCloudflareStatus(active, parsed);
          return jsonResult(result, "Estado de Cloudflare");
        },
      );
    },
  );
}
