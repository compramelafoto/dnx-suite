import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import { cloudflareProvider } from "../../providers/cloudflare/index.js";
import { isDryRunPreview, jsonResult, withAudit } from "../shared/index.js";
import { getCloudflareProvider } from "./context.js";
import { bucketNameSchema, cfDryRunSchema } from "./schemas.js";

const inputSchema = {
  bucket: bucketNameSchema,
  dryRun: cfDryRunSchema,
};

export async function handleR2BucketValidate(
  provider: CloudflareProvider,
  input: { bucket: string; dryRun: boolean },
) {
  if (isDryRunPreview(input)) {
    return {
      dryRun: true,
      preview: { wouldValidate: input.bucket },
    };
  }

  const validation = await provider.validateBucket(input.bucket);
  let corsReady: boolean | null = null;
  let publicDomainReady: boolean | null = null;

  if (validation.exists) {
    try {
      const rules = await provider.getCors(input.bucket);
      corsReady = provider.cors.isCorsReady(rules);
    } catch {
      corsReady = null;
    }
    try {
      const domain = await provider.getPublicDomain(input.bucket);
      publicDomainReady = domain.enabled;
    } catch {
      publicDomainReady = null;
    }
  }

  return {
    dryRun: false,
    ...validation,
    corsReady,
    publicDomainReady,
  };
}

export function registerR2BucketValidateTool(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  server.registerTool(
    "r2_bucket_validate",
    {
      title: "R2 Bucket Validate",
      description: "Valida existencia, naming y estado de un bucket R2 (solo lectura).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "r2_bucket_validate",
          action: "validate_bucket",
          dryRun: parsed.dryRun,
          confirmed: false,
          metadata: { bucket: parsed.bucket },
        },
        async () => {
          const active = getCloudflareProvider(provider);
          return jsonResult(await handleR2BucketValidate(active, parsed), "Validación R2 bucket");
        },
      );
    },
  );
}
