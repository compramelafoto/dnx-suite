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
  body: z.string().describe("Contenido del objeto (texto/base64 según contentType)"),
  contentType: z.string().default("application/octet-stream"),
  dryRun: cfDryRunSchema,
  confirm: cfConfirmSchema,
};

export async function handleR2ObjectUpload(
  provider: CloudflareProvider,
  input: {
    bucket: string;
    key: string;
    body: string;
    contentType: string;
    dryRun: boolean;
    confirm: boolean;
  },
) {
  const gate = resolveExecutionGate(input, "r2_object_upload");
  if (!gate.proceed) {
    return {
      dryRun: true,
      wouldUpload: true,
      bucket: input.bucket,
      key: input.key,
      contentType: input.contentType,
      bodyBytes: Buffer.byteLength(input.body),
      message: "dryRun — no se sube el objeto",
    };
  }

  return provider.uploadObject(input.bucket, input.key, input.body, input.contentType, true, false);
}

export function registerR2ObjectUploadTool(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  server.registerTool(
    "r2_object_upload",
    {
      title: "R2 Object Upload",
      description:
        "Sube un objeto a R2 (API S3-compatible). Default dryRun=true. Requiere dryRun:false + confirm:true y credenciales R2 S3.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "r2_object_upload",
          action: "upload_object",
          dryRun: parsed.dryRun,
          confirmed: parsed.confirm,
          metadata: { bucket: parsed.bucket, key: parsed.key },
        },
        async () => {
          const active = getCloudflareProvider(provider);
          return jsonResult(await handleR2ObjectUpload(active, parsed), "Upload objeto R2");
        },
      );
    },
  );
}
