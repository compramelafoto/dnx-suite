import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPlatform } from "../../platforms/index.js";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import { cloudflareProvider } from "../../providers/cloudflare/index.js";
import { isDryRunPreview, jsonResult, withAudit } from "../shared/index.js";
import { getCloudflareProvider } from "./context.js";
import { cfDryRunSchema, platformIdSchema } from "./schemas.js";

const inputSchema = {
  platformId: platformIdSchema,
  dryRun: cfDryRunSchema,
};

export async function handleR2StagingPlan(
  provider: CloudflareProvider,
  input: { platformId: string; dryRun: boolean },
) {
  const platform = getPlatform(input.platformId);
  if (!platform) {
    return {
      dryRun: input.dryRun,
      status: "BLOCKED" as const,
      blockers: [`Plataforma "${input.platformId}" no encontrada`],
    };
  }

  const stagingBucket = platform.r2?.stagingBucket ?? null;
  const productionBucket = platform.r2?.productionBucket ?? platform.r2?.bucket ?? null;

  if (isDryRunPreview(input)) {
    return {
      dryRun: true,
      platformId: input.platformId,
      stagingBucket,
      productionBucket,
      productionProtected: platform.r2?.productionProtected !== false,
      expectedPublicUrl: platform.r2?.expectedPublicUrl ?? platform.r2?.publicUrl ?? null,
      smokeTestObjectKey: platform.r2?.smokeTestObjectKey ?? null,
      preview: {
        wouldCall: ["prepareStagingBucket(dryRun)", "assessReleaseReadiness"],
      },
    };
  }

  if (!stagingBucket) {
    return {
      dryRun: false,
      platformId: input.platformId,
      status: "BLOCKED" as const,
      stagingBucket: null,
      productionBucket,
      blockers: ["Catalog sin stagingBucket — definir en Platform Catalog"],
      plan: [],
    };
  }

  const [prepare, readiness] = await Promise.all([
    provider.prepareStagingBucket({
      platformId: input.platformId,
      bucketName: stagingBucket,
      dryRun: true,
      confirm: false,
    }),
    provider.assessReleaseReadiness(platform),
  ]);

  return {
    dryRun: false,
    platformId: input.platformId,
    stagingBucket,
    productionBucket,
    productionProtected: platform.r2?.productionProtected !== false,
    expectedPublicUrl: platform.r2?.expectedPublicUrl ?? platform.r2?.publicUrl ?? null,
    smokeTestObjectKey: platform.r2?.smokeTestObjectKey ?? null,
    prepare,
    readiness,
    plan: [
      "1. r2_bucket_validate sobre staging",
      "2. r2_prepare_staging_bucket (dryRun=true) para auditar",
      "3. r2_prepare_application (dryRun=true) para credenciales R2_* + Preview env",
      "4. Con confirm+!dryRun: crear bucket / smoke / cargar Preview (solo staging)",
      "5. Nunca tocar buckets *-prod / productionBucket",
    ],
  };
}

export function registerR2StagingPlanTool(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  server.registerTool(
    "r2_staging_plan",
    {
      title: "R2 Staging Plan",
      description:
        "Plan de staging R2 para una plataforma: buckets catalog, prepare dry-run y readiness (solo lectura).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "r2_staging_plan",
          action: "staging_plan",
          dryRun: parsed.dryRun,
          confirmed: false,
          metadata: { platformId: parsed.platformId },
        },
        async () => {
          const active = getCloudflareProvider(provider);
          return jsonResult(await handleR2StagingPlan(active, parsed), "Plan R2 staging");
        },
      );
    },
  );
}
