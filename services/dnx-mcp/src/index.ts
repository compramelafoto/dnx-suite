#!/usr/bin/env node

import "./config/bootstrap-env.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadEnv } from "./config/index.js";
import { createServer } from "./server/index.js";
import { logger, setLogLevel } from "./utils/index.js";

async function main(): Promise<void> {
  const env = loadEnv();
  setLogLevel(env.LOG_LEVEL);

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info("DNX-MCP server iniciado correctamente");
}

main().catch((error: unknown) => {
  logger.error("Error fatal al iniciar DNX-MCP", error);
  process.exit(1);
});
