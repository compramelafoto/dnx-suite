import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VercelProvider } from "../../providers/vercel/index.js";
import { vercelProvider } from "../../providers/vercel/index.js";
import { registerVercelDeployReleaseTool } from "./vercel-deploy-release.js";
import { registerVercelPrepareProductionReleaseTool } from "./vercel-prepare-production-release.js";
import { registerVercelPrepareStagingTool } from "./vercel-prepare-staging.js";
import { registerVercelRollbackReleaseTool } from "./vercel-rollback-release.js";
import { registerVercelStatusTool } from "./vercel-status.js";
import { registerVercelValidateStagingTool } from "./vercel-validate-staging.js";

export function registerVercelTools(
  server: McpServer,
  provider: VercelProvider = vercelProvider,
): void {
  registerVercelStatusTool(server, provider);
  registerVercelPrepareStagingTool(server, provider);
  registerVercelValidateStagingTool(server, provider);
  registerVercelPrepareProductionReleaseTool(server, provider);
  registerVercelDeployReleaseTool(server, provider);
  registerVercelRollbackReleaseTool(server, provider);
}

export { handleVercelStatus } from "./vercel-status.js";
export { handleVercelPrepareStaging } from "./vercel-prepare-staging.js";
export { handleVercelValidateStaging } from "./vercel-validate-staging.js";
export { handleVercelPrepareProductionRelease } from "./vercel-prepare-production-release.js";
export { handleVercelDeployRelease } from "./vercel-deploy-release.js";
export { handleVercelRollbackRelease } from "./vercel-rollback-release.js";
