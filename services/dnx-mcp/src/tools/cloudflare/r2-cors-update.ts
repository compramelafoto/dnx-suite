import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import { cloudflareProvider, r2CorsRuleSchema } from "../../providers/cloudflare/index.js";
import { jsonResult, resolveExecutionGate, withAudit } from "../shared/index.js";
import { getCloudflareProvider } from "./context.js";
import { bucketNameSchema, cfConfirmSchema, cfDryRunSchema } from "./schemas.js";

const inputSchema = {
  bucket: bucketNameSchema,
  rules: z.array(r2CorsRuleSchema).min(1),
  dryRun: cfDryRunSchema,
  confirm: cfConfirmSchema,
};

export async function handleR2CorsUpdate(
  provider: CloudflareProvider,
  input: {
    bucket: string;
    rules: z.infer<typeof r2CorsRuleSchema>[];
    dryRun: boolean;
    confirm: boolean;
  },
) {
  const gate = resolveExecutionGate(input, "r2_cors_update");
  if (!gate.proceed) {
    return {
      dryRun: true,
      wouldUpdate: true,
      bucket: input.bucket,
      rules: input.rules,
      message: "dryRun — no se actualiza CORS",
    };
  }

  return provider.updateCors(input.bucket, input.rules, true, false);
}

export function registerR2CorsUpdateTool(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  server.registerTool(
    "r2_cors_update",
    {
      title: "R2 CORS Update",
      description:
        "Actualiza CORS de un bucket R2. Default dryRun=true. Requiere dryRun:false + confirm:true.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "r2_cors_update",
          action: "update_cors",
          dryRun: parsed.dryRun,
          confirmed: parsed.confirm,
          metadata: { bucket: parsed.bucket },
        },
        async () => {
          const active = getCloudflareProvider(provider);
          return jsonResult(await handleR2CorsUpdate(active, parsed), "Actualizar CORS R2");
        },
      );
    },
  );
}
