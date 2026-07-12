import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import { cloudflareProvider } from "../../providers/cloudflare/index.js";
import { jsonResult, resolveExecutionGate, withAudit } from "../shared/index.js";
import { getCloudflareProvider } from "./context.js";
import { bucketNameSchema, cfConfirmSchema, cfDryRunSchema, objectKeySchema } from "./schemas.js";

const inputSchema = {
  bucket: bucketNameSchema,
  key: objectKeySchema,
  dryRun: cfDryRunSchema,
  confirm: cfConfirmSchema,
};

export async function handleR2ObjectDelete(
  provider: CloudflareProvider,
  input: { bucket: string; key: string; dryRun: boolean; confirm: boolean },
) {
  const gate = resolveExecutionGate(input, "r2_object_delete");
  if (!gate.proceed) {
    return {
      dryRun: true,
      wouldDelete: true,
      bucket: input.bucket,
      key: input.key,
      message: "dryRun — no se elimina el objeto",
    };
  }

  return provider.deleteObject(input.bucket, input.key, true, false);
}

export function registerR2ObjectDeleteTool(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  server.registerTool(
    "r2_object_delete",
    {
      title: "R2 Object Delete",
      description:
        "Elimina un objeto R2. Default dryRun=true. Requiere dryRun:false + confirm:true.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "r2_object_delete",
          action: "delete_object",
          dryRun: parsed.dryRun,
          confirmed: parsed.confirm,
          metadata: { bucket: parsed.bucket, key: parsed.key },
        },
        async () => {
          const active = getCloudflareProvider(provider);
          return jsonResult(await handleR2ObjectDelete(active, parsed), "Eliminar objeto R2");
        },
      );
    },
  );
}
