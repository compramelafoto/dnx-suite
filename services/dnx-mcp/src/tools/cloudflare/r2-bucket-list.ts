import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import { cloudflareProvider } from "../../providers/cloudflare/index.js";
import { isDryRunPreview, jsonResult, withAudit } from "../shared/index.js";
import { getCloudflareProvider } from "./context.js";
import { cfDryRunSchema } from "./schemas.js";

const inputSchema = {
  dryRun: cfDryRunSchema,
};

export async function handleR2BucketList(provider: CloudflareProvider, input: { dryRun: boolean }) {
  if (isDryRunPreview(input)) {
    return { dryRun: true, preview: { wouldFetch: ["listBuckets"] } };
  }

  const buckets = await provider.listBuckets();
  return {
    dryRun: false,
    buckets,
    count: buckets.length,
  };
}

export function registerR2BucketListTool(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  server.registerTool(
    "r2_bucket_list",
    {
      title: "R2 Bucket List",
      description: "Lista buckets R2 de la cuenta Cloudflare (solo lectura).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "r2_bucket_list",
          action: "list_buckets",
          dryRun: parsed.dryRun,
          confirmed: false,
        },
        async () => {
          const active = getCloudflareProvider(provider);
          return jsonResult(await handleR2BucketList(active, parsed), "Buckets R2");
        },
      );
    },
  );
}
