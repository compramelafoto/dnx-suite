import type { IncomingMessage, ServerResponse } from "node:http";
import { registerRoutes } from "../routes/register-routes.js";
import { isReviewLabEnabled } from "../review-lab/enabled.js";
import { serveReviewLabStatic } from "../review-lab/ui/serve-static.js";
import { sendJson } from "../server/http-response.js";
import type { AppDeps } from "../types/app-deps.js";
import type { HttpMethod, RouteDefinition } from "../types/http.js";

function normalizePath(url: string | undefined): string {
  if (!url) return "/";
  const pathOnly = url.split("?")[0] ?? "/";
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) {
    return pathOnly.slice(0, -1);
  }
  return pathOnly;
}

function matchRoute(
  routes: RouteDefinition[],
  method: string,
  path: string,
): RouteDefinition | undefined {
  const exact = routes.find(
    (route) => route.method === (method as HttpMethod) && route.path === path,
  );
  if (exact) return exact;

  return routes.find((route) => {
    if (route.method !== (method as HttpMethod)) return false;
    if (!route.path.includes(":")) return false;
    const pattern = `^${route.path.replace(/:[^/]+/g, "[^/]+")}$`;
    return new RegExp(pattern).test(path);
  });
}

export function createApp(deps: AppDeps) {
  const routes = registerRoutes(deps);
  const labEnabled = isReviewLabEnabled();

  return async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const method = req.method ?? "GET";
    const path = normalizePath(req.url);

    if (labEnabled && method === "GET" && path.startsWith("/review-lab")) {
      // API + visual assets: rutas registradas. Resto: UI estática.
      const isLabApi =
        path.startsWith("/review-lab/api") ||
        path.startsWith("/review-lab/assets/visual-references/");
      if (!isLabApi) {
        const served = await serveReviewLabStatic(req, res, path);
        if (served) return;
      }
    }

    const route = matchRoute(routes, method, path);

    if (!route) {
      sendJson(res, 404, {
        ok: false,
        error: "not_found",
        service: deps.config.serviceName,
      });
      return;
    }

    await route.handler(req, res);
  };
}
