import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolRegistrar } from "../types/mcp.js";
import { registerCloudflareTools } from "./cloudflare/index.js";
import { registerReleaseTools } from "./release/index.js";
import { registerVercelTools } from "./vercel/index.js";

/**
 * Registro de herramientas MCP.
 * Agregar nuevas tools aquí — cada una debe delegar en providers.
 */
const toolRegistrars: ToolRegistrar[] = [
  registerVercelTools,
  registerCloudflareTools,
  registerReleaseTools,
];

/**
 * Registra todas las herramientas MCP en el servidor.
 */
export function registerTools(server: McpServer): void {
  for (const register of toolRegistrars) {
    register(server);
  }
}
