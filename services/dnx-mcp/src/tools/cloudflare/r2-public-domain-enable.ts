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

export async function handleR2PublicDomainEnable(
  provider: CloudflareProvider,
  input: { bucket: string; dryRun: boolean; confirm: boolean },
) {
  const gate = resolveExecutionGate(input, "r2_public_domain_enable");
  if (!gate.proceed) {
    return {
      dryRun: true,
      wouldEnable: true,
      bucket: input.bucket,
      message: "dryRun — no se habilita dominio público",
    };
  }

  return provider.enablePublicDomain(input.bucket, true, false);
}

export function registerR2PublicDomainEnableTool(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  server.registerTool(
    "r2_public_domain_enable",
    {
      title: "R2 Public Domain Enable",
      description:
        "Habilita dominio managed r2.dev en un bucket. Default dryRun=true. Requiere dryRun:false + confirm:true.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "r2_public_domain_enable",
          action: "enable_public_domain",
          dryRun: parsed.dryRun,
          confirmed: parsed.confirm,
          metadata: { bucket: parsed.bucket },
        },
        async () => {
          const active = getCloudflareProvider(provider);
          return jsonResult(
            await handleR2PublicDomainEnable(active, parsed),
            "Habilitar dominio público R2",
          );
        },
      );
    },
  );
}
