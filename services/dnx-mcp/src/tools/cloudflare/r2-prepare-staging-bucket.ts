import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import { cloudflareProvider } from "../../providers/cloudflare/index.js";
import { jsonResult, withAudit } from "../shared/index.js";
import { getCloudflareProvider } from "./context.js";
import { bucketNameSchema, cfConfirmSchema, cfDryRunSchema, platformIdSchema } from "./schemas.js";

const inputSchema = {
  platformId: platformIdSchema,
  bucketName: bucketNameSchema,
  dryRun: cfDryRunSchema,
  confirm: cfConfirmSchema,
};

export async function handleR2PrepareStagingBucket(
  provider: CloudflareProvider,
  input: {
    platformId: string;
    bucketName: string;
    dryRun: boolean;
    confirm: boolean;
  },
) {
  return provider.prepareStagingBucket({
    platformId: input.platformId,
    bucketName: input.bucketName,
    dryRun: input.dryRun,
    confirm: input.confirm,
  });
}

export function registerR2PrepareStagingBucketTool(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  server.registerTool(
    "r2_prepare_staging_bucket",
    {
      title: "R2 Prepare Staging Bucket",
      description:
        "Audita/prepara bucket staging (-staging). Crea solo con dryRun:false + confirm:true. Nunca toca prod.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "r2_prepare_staging_bucket",
          action: "prepare_staging_bucket",
          dryRun: parsed.dryRun,
          confirmed: parsed.confirm,
          metadata: { platformId: parsed.platformId, bucket: parsed.bucketName },
        },
        async () => {
          const active = getCloudflareProvider(provider);
          return jsonResult(
            await handleR2PrepareStagingBucket(active, parsed),
            "Prepare staging R2",
          );
        },
      );
    },
  );
}
