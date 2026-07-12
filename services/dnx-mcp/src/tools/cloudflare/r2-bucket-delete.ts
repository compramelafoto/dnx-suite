import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import { cloudflareProvider } from "../../providers/cloudflare/index.js";
import { jsonResult, resolveExecutionGate, withAudit } from "../shared/index.js";
import { getCloudflareProvider } from "./context.js";
import { bucketNameSchema, cfConfirmSchema, cfDryRunSchema } from "./schemas.js";

const inputSchema = {
  bucket: bucketNameSchema,
  dryRun: cfDryRunSchema,
  confirm: cfConfirmSchema,
};

export async function handleR2BucketDelete(
  provider: CloudflareProvider,
  input: { bucket: string; dryRun: boolean; confirm: boolean },
) {
  const gate = resolveExecutionGate(input, "r2_bucket_delete");
  if (!gate.proceed) {
    return {
      dryRun: true,
      wouldDelete: true,
      bucket: input.bucket,
      message: "dryRun — no se elimina el bucket",
    };
  }

  return provider.deleteBucket(input.bucket, true, false);
}

export function registerR2BucketDeleteTool(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  server.registerTool(
    "r2_bucket_delete",
    {
      title: "R2 Bucket Delete",
      description:
        "Elimina un bucket R2. Default dryRun=true. Requiere dryRun:false + confirm:true. Producción bloqueada.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "r2_bucket_delete",
          action: "delete_bucket",
          dryRun: parsed.dryRun,
          confirmed: parsed.confirm,
          metadata: { bucket: parsed.bucket },
        },
        async () => {
          const active = getCloudflareProvider(provider);
          return jsonResult(await handleR2BucketDelete(active, parsed), "Eliminar bucket R2");
        },
      );
    },
  );
}
