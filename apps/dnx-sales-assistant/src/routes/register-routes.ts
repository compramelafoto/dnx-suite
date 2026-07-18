import type { RouteDefinition } from "../types/http.js";
import type { AppDeps } from "../types/app-deps.js";
import { createHealthHandler } from "../health/handler.js";
import { createSimulateMessageHandler } from "../simulate/handler.js";
import {
  createReviewLabRuntime,
  registerReviewLabRoutes,
} from "../review-lab/register-review-lab-routes.js";

export function registerRoutes(deps: AppDeps): RouteDefinition[] {
  const reviewLab = createReviewLabRuntime(deps);
  return [
    {
      method: "GET",
      path: "/health",
      handler: createHealthHandler(deps.config),
    },
    {
      method: "POST",
      path: "/simulate/message",
      handler: createSimulateMessageHandler(deps),
    },
    ...registerReviewLabRoutes(reviewLab),
  ];
}
