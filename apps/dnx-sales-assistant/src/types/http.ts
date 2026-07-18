import type { IncomingMessage, ServerResponse } from "node:http";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => void | Promise<void>;

export type RouteDefinition = {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
};
