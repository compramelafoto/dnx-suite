import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShape } from "zod";

/**
 * Definición de una herramienta MCP registrable.
 * Las tools solo orquestan providers — no contienen lógica de integración.
 */
export interface ToolDefinition<TShape extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  inputSchema: TShape;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export type ToolRegistrar = (server: McpServer) => void;
