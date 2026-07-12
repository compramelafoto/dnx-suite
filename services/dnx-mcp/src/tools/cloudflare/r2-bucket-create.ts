import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import { cloudflareProvider } from "../../providers/cloudflare/index.js";
import { jsonResult, resolveExecutionGate, withAudit } from "../shared/index.js";
import { getCloudflareProvider } from "./context.js";
import { bucketNameSchema, cfConfirmSchema, cfDryRunSchema } from "./schemas.js";

const inputSchema = {
  bucket: bucketNameSchema,
  locationHint: z.string().optional(),
  dryRun: cfDryRunSchema,
  confirm: cfConfirmSchema,
};

export async function handleR2BucketCreate(
  provider: CloudflareProvider,
  input: {
    bucket: string;
    locationHint?: string | undefined;
    dryRun: boolean;
    confirm: boolean;
  },
) {
  const gate = resolveExecutionGate(input, "r2_bucket_create");
  if (!gate.proceed) {
    return {
      dryRun: true,
      wouldCreate: true,
      bucket: input.bucket,
      message: "dryRun — no se crea el bucket",
    };
  }

  return provider.createBucket(input.bucket, {
    dryRun: false,
    confirm: true,
    ...(input.locationHint ? { locationHint: input.locationHint } : {}),
  });
}

export function registerR2BucketCreateTool(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  server.registerTool(
    "r2_bucket_create",
    {
      title: "R2 Bucket Create",
      description:
        "Crea un bucket R2. Default dryRun=true. Requiere dryRun:false + confirm:true. Bloquea nombres de producción.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "r2_bucket_create",
          action: "create_bucket",
          dryRun: parsed.dryRun,
          confirmed: parsed.confirm,
          metadata: { bucket: parsed.bucket },
        },
        async () => {
          const active = getCloudflareProvider(provider);
          return jsonResult(await handleR2BucketCreate(active, parsed), "Crear bucket R2");
        },
      );
    },
  );
}
