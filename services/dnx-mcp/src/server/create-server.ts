import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../tools/index.js";

export interface ServerOptions {
  name?: string;
  version?: string;
}

const DEFAULT_NAME = "dnx-mcp";
const DEFAULT_VERSION = "0.1.0";

/**
 * Crea e inicializa el servidor MCP de DNX.
 */
export function createServer(options: ServerOptions = {}): McpServer {
  const server = new McpServer({
    name: options.name ?? DEFAULT_NAME,
    version: options.version ?? DEFAULT_VERSION,
  });

  registerTools(server);

  return server;
}
