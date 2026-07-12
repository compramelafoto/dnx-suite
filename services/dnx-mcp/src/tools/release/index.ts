import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReleaseOrchestrator } from "../../orchestrators/release/index.js";
import type { ProviderRegistry } from "../../providers/registry/index.js";
import { getReleaseOrchestrator } from "./context.js";
import { registerReleaseExecuteTool } from "./release-execute.js";
import { registerReleasePrepareTool } from "./release-prepare.js";
import { registerReleaseRollbackTool } from "./release-rollback.js";
import { registerReleaseValidateTool } from "./release-validate.js";

export function registerReleaseTools(
  server: McpServer,
  options: {
    orchestrator?: ReleaseOrchestrator;
    registry?: ProviderRegistry;
  } = {},
): void {
  const orchestrator = getReleaseOrchestrator({
    ...(options.orchestrator ? { orchestrator: options.orchestrator } : {}),
    ...(options.registry ? { registry: options.registry } : {}),
  });

  registerReleasePrepareTool(server, orchestrator);
  registerReleaseValidateTool(server, orchestrator);
  registerReleaseExecuteTool(server, orchestrator);
  registerReleaseRollbackTool(server, orchestrator);
}

export { handleReleasePrepare } from "./release-prepare.js";
export { handleReleaseValidate } from "./release-validate.js";
export { handleReleaseExecute } from "./release-execute.js";
export { handleReleaseRollback } from "./release-rollback.js";
export {
  getReleaseOrchestrator,
  getProviderRegistry,
  resolvePlatform,
  resetReleaseToolContext,
} from "./context.js";
export {
  releasePrepareInputSchema,
  releaseValidateInputSchema,
  releaseExecuteInputSchema,
  releaseRollbackInputSchema,
} from "./schemas.js";
