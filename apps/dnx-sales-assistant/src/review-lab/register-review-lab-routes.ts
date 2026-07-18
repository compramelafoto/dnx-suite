import type { RouteDefinition } from "../types/http.js";
import { isReviewLabEnabled } from "./enabled.js";
import { createLabApiHandlers } from "./api/create-lab-handlers.js";
import { ReviewLabService } from "./api/lab-service.js";
import { LabSessionStore } from "./session/lab-session-store.js";
import type { AppDeps } from "../types/app-deps.js";
import type { ReviewLabDeps } from "./api/lab-service.js";
import { CalibrationLabApi } from "../calibration/lab/calibration-lab-api.js";
import { PricingReviewLabApi } from "../pricing-review/lab/pricing-review-lab-api.js";

export type ReviewLabRuntime = {
  enabled: boolean;
  service?: ReviewLabService;
  calibration?: CalibrationLabApi;
  pricingReview?: PricingReviewLabApi;
};

export function createReviewLabRuntime(deps: AppDeps): ReviewLabRuntime {
  if (!isReviewLabEnabled()) {
    return { enabled: false };
  }
  const labSessions = new LabSessionStore();
  const pricingReview = new PricingReviewLabApi(deps.store);
  const labDeps: ReviewLabDeps = {
    ...deps,
    labSessions,
    onPricingReviewSessionReset: (id) => pricingReview.resetSession(id),
  };
  const service = new ReviewLabService(labDeps);
  return {
    enabled: true,
    service,
    calibration: new CalibrationLabApi(),
    pricingReview,
  };
}

export function registerReviewLabRoutes(
  runtime: ReviewLabRuntime,
): RouteDefinition[] {
  if (
    !runtime.enabled ||
    !runtime.service ||
    !runtime.calibration ||
    !runtime.pricingReview
  ) {
    return [];
  }
  const h = createLabApiHandlers(
    runtime.service,
    runtime.calibration,
    runtime.pricingReview,
  );
  return [
    { method: "POST", path: "/review-lab/api/session", handler: h.createSession },
    { method: "POST", path: "/review-lab/api/message", handler: h.postMessage },
    { method: "POST", path: "/review-lab/api/reset", handler: h.reset },
    { method: "POST", path: "/review-lab/api/engine", handler: h.setEngine },
    { method: "POST", path: "/review-lab/api/compare", handler: h.compare },
    { method: "GET", path: "/review-lab/api/scenarios", handler: h.listScenarios },
    { method: "POST", path: "/review-lab/api/scenario/load", handler: h.loadScenario },
    { method: "POST", path: "/review-lab/api/scenario/step", handler: h.runScenarioStep },
    { method: "POST", path: "/review-lab/api/scenario/run", handler: h.runScenarioAll },
    { method: "POST", path: "/review-lab/api/review", handler: h.review },
    { method: "POST", path: "/review-lab/api/export", handler: h.exportSession },
    {
      method: "GET",
      path: "/review-lab/api/visual-references",
      handler: h.listVisualReferences,
    },
    {
      method: "GET",
      path: "/review-lab/api/visual-references/:id",
      handler: h.getVisualReference,
    },
    {
      method: "GET",
      path: "/review-lab/assets/visual-references/:id",
      handler: h.getVisualAsset,
    },
    {
      method: "POST",
      path: "/review-lab/api/visual-review",
      handler: h.reviewVisual,
    },
    {
      method: "GET",
      path: "/review-lab/api/calibration",
      handler: h.calibrationInbox,
    },
    {
      method: "POST",
      path: "/review-lab/api/calibration/ingest",
      handler: h.calibrationIngest,
    },
    {
      method: "POST",
      path: "/review-lab/api/calibration/code",
      handler: h.calibrationSetCode,
    },
    {
      method: "POST",
      path: "/review-lab/api/calibration/copy-proposal",
      handler: h.calibrationCopyProposal,
    },
    {
      method: "POST",
      path: "/review-lab/api/calibration/simulate",
      handler: h.calibrationSimulate,
    },
    {
      method: "POST",
      path: "/review-lab/api/calibration/propose-golden",
      handler: h.calibrationProposeGolden,
    },
    {
      method: "POST",
      path: "/review-lab/api/calibration/confirm-golden",
      handler: h.calibrationConfirmGolden,
    },
    {
      method: "POST",
      path: "/review-lab/api/calibration/generate-candidates",
      handler: h.calibrationGenerateCandidates,
    },
    {
      method: "POST",
      path: "/review-lab/api/calibration/export",
      handler: h.calibrationExport,
    },
    {
      method: "GET",
      path: "/review-lab/api/pricing-review",
      handler: h.pricingReviewGet,
    },
    {
      method: "POST",
      path: "/review-lab/api/pricing-review/calculate",
      handler: h.pricingReviewCalculate,
    },
    {
      method: "POST",
      path: "/review-lab/api/pricing-review/explain",
      handler: h.pricingReviewExplain,
    },
    {
      method: "POST",
      path: "/review-lab/api/pricing-review/review",
      handler: h.pricingReviewHuman,
    },
    {
      method: "POST",
      path: "/review-lab/api/pricing-review/export",
      handler: h.pricingReviewExport,
    },
  ];
}
