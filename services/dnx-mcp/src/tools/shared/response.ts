import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Formatea la salida de una tool MCP como JSON legible.
 */
export function jsonResult(data: unknown, summary?: string): CallToolResult {
  const text = JSON.stringify(data, null, 2);

  return {
    content: [
      {
        type: "text",
        text: summary ? `${summary}\n\n${text}` : text,
      },
    ],
  };
}

export function textResult(text: string): CallToolResult {
  return {
    content: [{ type: "text", text }],
  };
}

export function errorResult(message: string, details?: unknown): CallToolResult {
  return jsonResult(
    {
      success: false,
      error: message,
      details,
    },
    `Error: ${message}`,
  );
}
