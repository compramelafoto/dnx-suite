import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import { cloudflareProvider } from "../../providers/cloudflare/index.js";
import { jsonResult, withAudit } from "../shared/index.js";
import { getCloudflareProvider } from "./context.js";
import { cfConfirmSchema, cfDryRunSchema, platformIdSchema } from "./schemas.js";

const inputSchema = {
  platformId: platformIdSchema,
  dryRun: cfDryRunSchema,
  confirm: cfConfirmSchema,
  loadEnvToVercelPreview: z
    .boolean()
    .default(false)
    .describe(
      "Si true, crea en Vercel Preview las R2_* faltantes (solo target preview; nunca production)",
    ),
};

export async function handleR2PrepareApplication(
  provider: CloudflareProvider,
  input: {
    platformId: string;
    dryRun: boolean;
    confirm: boolean;
    loadEnvToVercelPreview: boolean;
  },
) {
  return provider.prepareApplication({
    platformId: input.platformId,
    dryRun: input.dryRun,
    confirm: input.confirm,
    loadEnvToVercelPreview: input.loadEnvToVercelPreview,
  });
}

export function registerR2PrepareApplicationTool(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  server.registerTool(
    "r2_prepare_application",
    {
      title: "R2 Prepare Application",
      description:
        "Prepara R2 staging para una app (platformId): verifica bucket, crea credenciales S3 si faltan, " +
        "genera R2_*, detecta faltantes en Vercel Preview (opcional cargar), valida upload/download. " +
        "Defaults: dryRun=true, confirm=false. Nunca toca producción ni DNS.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "r2_prepare_application",
          action: "prepare_application",
          dryRun: parsed.dryRun,
          confirmed: parsed.confirm,
          metadata: {
            platformId: parsed.platformId,
            loadEnvToVercelPreview: parsed.loadEnvToVercelPreview,
          },
        },
        async () => {
          const active = getCloudflareProvider(provider);
          const result = await handleR2PrepareApplication(active, parsed);
          return jsonResult(result, `R2 prepare application — ${result.status}`);
        },
      );
    },
  );
}
