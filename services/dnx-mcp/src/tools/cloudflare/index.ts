import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import {
  cloudflareProvider,
  createCloudflareProvider,
  createVercelPreviewEnvPort,
} from "../../providers/cloudflare/index.js";
import { vercelProvider } from "../../providers/vercel/index.js";
import { registerCloudflareStatusTool } from "./cloudflare-status.js";
import { registerR2BucketListTool } from "./r2-bucket-list.js";
import { registerR2BucketValidateTool } from "./r2-bucket-validate.js";
import { registerR2StagingPlanTool } from "./r2-staging-plan.js";
import { registerR2BucketCreateTool } from "./r2-bucket-create.js";
import { registerR2BucketDeleteTool } from "./r2-bucket-delete.js";
import { registerR2CorsUpdateTool } from "./r2-cors-update.js";
import { registerR2PublicDomainEnableTool } from "./r2-public-domain-enable.js";
import { registerR2ObjectUploadTool } from "./r2-object-upload.js";
import { registerR2ObjectDeleteTool } from "./r2-object-delete.js";
import { registerR2PrepareStagingBucketTool } from "./r2-prepare-staging-bucket.js";
import { registerR2PrepareApplicationTool } from "./r2-prepare-application.js";

function resolveCloudflareProviderForTools(
  provider: CloudflareProvider,
): CloudflareProvider {
  if (provider !== cloudflareProvider) {
    return provider;
  }
  return createCloudflareProvider({
    vercelPreviewEnv: createVercelPreviewEnvPort(vercelProvider),
  });
}

export function registerCloudflareTools(
  server: McpServer,
  provider: CloudflareProvider = cloudflareProvider,
): void {
  const active = resolveCloudflareProviderForTools(provider);
  registerCloudflareStatusTool(server, active);
  registerR2BucketListTool(server, active);
  registerR2BucketValidateTool(server, active);
  registerR2StagingPlanTool(server, active);
  registerR2BucketCreateTool(server, active);
  registerR2BucketDeleteTool(server, active);
  registerR2CorsUpdateTool(server, active);
  registerR2PublicDomainEnableTool(server, active);
  registerR2ObjectUploadTool(server, active);
  registerR2ObjectDeleteTool(server, active);
  registerR2PrepareStagingBucketTool(server, active);
  registerR2PrepareApplicationTool(server, active);
}

export { handleCloudflareStatus } from "./cloudflare-status.js";
export { handleR2BucketList } from "./r2-bucket-list.js";
export { handleR2BucketValidate } from "./r2-bucket-validate.js";
export { handleR2StagingPlan } from "./r2-staging-plan.js";
export { handleR2BucketCreate } from "./r2-bucket-create.js";
export { handleR2BucketDelete } from "./r2-bucket-delete.js";
export { handleR2CorsUpdate } from "./r2-cors-update.js";
export { handleR2PublicDomainEnable } from "./r2-public-domain-enable.js";
export { handleR2ObjectUpload } from "./r2-object-upload.js";
export { handleR2ObjectDelete } from "./r2-object-delete.js";
export { handleR2PrepareStagingBucket } from "./r2-prepare-staging-bucket.js";
export { handleR2PrepareApplication } from "./r2-prepare-application.js";
