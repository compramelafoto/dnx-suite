import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GoogleCloudProvider } from "../../providers/google-cloud/index.js";
import { googleCloudProvider } from "../../providers/google-cloud/index.js";
import { registerDiagnosticTools } from "./diagnostic-tools.js";
import { registerProjectTools } from "./project-tools.js";
import { registerServiceAccountTools } from "./service-account-tools.js";
import { registerSecretManagerTools } from "./secret-manager-tools.js";
import { registerServiceTools } from "./service-tools.js";

export function registerGoogleCloudTools(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  registerDiagnosticTools(server, provider);
  registerProjectTools(server, provider);
  registerServiceTools(server, provider);
  registerServiceAccountTools(server, provider);
  registerSecretManagerTools(server, provider);
}

export { getGoogleCloudProvider } from "./context.js";
export type { FutureServiceAccountRoleTools } from "./service-account-tools.js";
