import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../../server/http-response.js";
import type { ConversationStyleEngine } from "../../conversation/style/conversation-style-engine.js";
import { sendLabSafeError } from "./lab-error.js";
import { readJsonBody } from "./read-json-body.js";
import type { ReviewLabService } from "./lab-service.js";
import type {
  HumanReviewVerdict,
  HumanVisualReferenceVerdict,
} from "../session/lab-models.js";
import type { CalibrationLabApi } from "../../calibration/lab/calibration-lab-api.js";
import type { PricingReviewLabApi } from "../../pricing-review/lab/pricing-review-lab-api.js";
import type {
  PricingExplanationReviewCode,
  PricingExplanationReviewVerdict,
} from "../../pricing-review/domain/pricing-review-models.js";
import { sanitizeLabSessionExport } from "../export/sanitize-export.js";

function pathId(req: IncomingMessage, prefix: string): string | undefined {
  const pathOnly = (req.url ?? "").split("?")[0] ?? "";
  if (!pathOnly.startsWith(prefix)) return undefined;
  const rest = pathOnly.slice(prefix.length);
  if (!rest || rest.includes("/") || rest.includes("..")) return undefined;
  try {
    return decodeURIComponent(rest);
  } catch {
    return undefined;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function createLabApiHandlers(
  service: ReviewLabService,
  calibration: CalibrationLabApi,
  pricingReview: PricingReviewLabApi,
) {
  return {
    async createSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as { styleEngine?: string };
        const engine =
          body.styleEngine === "legacy"
            ? ("legacy" as ConversationStyleEngine)
            : ("dani-conversation-v1" as ConversationStyleEngine);
        const session = service.createSession(engine);
        sendJson(res, 200, { ok: true, session: service.sessionView(session) });
      } catch {
        sendLabSafeError(res, 400, "session_create_failed");
      }
    },

    async postMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as {
          sessionId?: string;
          message?: string;
        };
        const sessionId = asString(body.sessionId);
        const message = asString(body.message);
        if (!sessionId || !message) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const result = await service.postMessage(sessionId, message);
        sendJson(res, 200, {
          ok: true,
          turn: result.turn,
          session: service.sessionView(result.session),
        });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "message_failed";
        const status =
          code === "SESSION_NOT_FOUND"
            ? 404
            : code === "MESSAGE_TOO_LONG" || code === "TURN_LIMIT"
              ? 400
              : 400;
        sendLabSafeError(res, status, code.toLowerCase());
      }
    },

    async reset(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as { sessionId?: string };
        const sessionId = asString(body.sessionId);
        if (!sessionId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const session = await service.resetSession(sessionId);
        if (!session) {
          sendLabSafeError(res, 404, "session_not_found");
          return;
        }
        sendJson(res, 200, { ok: true, session: service.sessionView(session) });
      } catch {
        sendLabSafeError(res, 400, "reset_failed");
      }
    },

    async setEngine(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as {
          sessionId?: string;
          styleEngine?: string;
        };
        const sessionId = asString(body.sessionId);
        if (!sessionId || (body.styleEngine !== "legacy" && body.styleEngine !== "dani-conversation-v1")) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const session = service.setStyleEngine(
          sessionId,
          body.styleEngine as ConversationStyleEngine,
        );
        if (!session) {
          sendLabSafeError(res, 404, "session_not_found");
          return;
        }
        sendJson(res, 200, { ok: true, session: service.sessionView(session) });
      } catch {
        sendLabSafeError(res, 400, "engine_failed");
      }
    },

    async compare(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as {
          sessionId?: string;
          message?: string;
        };
        const sessionId = asString(body.sessionId);
        const message = asString(body.message);
        if (!sessionId || !message) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const result = await service.compare(sessionId, message);
        sendJson(res, 200, { ok: true, ...result });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "compare_failed";
        sendLabSafeError(res, code === "SESSION_NOT_FOUND" ? 404 : 400, code.toLowerCase());
      }
    },

    async listScenarios(_req: IncomingMessage, res: ServerResponse): Promise<void> {
      sendJson(res, 200, { ok: true, scenarios: service.listScenarios() });
    },

    async loadScenario(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as {
          sessionId?: string;
          scenarioId?: string;
        };
        if (!body.sessionId || !body.scenarioId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const session = await service.loadScenario(body.sessionId, body.scenarioId);
        sendJson(res, 200, { ok: true, session: service.sessionView(session) });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "scenario_load_failed";
        sendLabSafeError(res, code === "SESSION_NOT_FOUND" ? 404 : 400, code.toLowerCase());
      }
    },

    async runScenarioStep(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as { sessionId?: string };
        if (!body.sessionId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const result = await service.runScenarioStep(body.sessionId);
        sendJson(res, 200, {
          ok: true,
          done: result.done,
          turn: result.turn,
          session: service.sessionView(result.session),
        });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "scenario_step_failed";
        sendLabSafeError(res, 400, code.toLowerCase());
      }
    },

    async runScenarioAll(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as { sessionId?: string };
        if (!body.sessionId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const result = await service.runScenarioAll(body.sessionId);
        sendJson(res, 200, {
          ok: true,
          passed: result.passed,
          score: result.score,
          expectationFailures: result.expectationFailures,
          session: service.sessionView(result.session),
        });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "scenario_run_failed";
        sendLabSafeError(res, 400, code.toLowerCase());
      }
    },

    async review(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as {
          sessionId?: string;
          turnNumber?: number;
          verdict?: string;
          note?: string;
        };
        const verdicts: HumanReviewVerdict[] = [
          "APPROVED",
          "NEEDS_ADJUSTMENT",
          "INCORRECT",
        ];
        if (
          !body.sessionId ||
          typeof body.turnNumber !== "number" ||
          !verdicts.includes(body.verdict as HumanReviewVerdict)
        ) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const review = service.addReview({
          sessionId: body.sessionId,
          turnNumber: body.turnNumber,
          verdict: body.verdict as HumanReviewVerdict,
          note: body.note,
        });
        const session = service.getSession(body.sessionId)!;
        sendJson(res, 200, {
          ok: true,
          review,
          session: service.sessionView(session),
        });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "review_failed";
        sendLabSafeError(res, 400, code.toLowerCase());
      }
    },

    async exportSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as { sessionId?: string };
        if (!body.sessionId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const result = await service.exportSession(body.sessionId);
        sendJson(res, 200, {
          ok: true,
          export: result.payload,
          savedTo: result.filePath.split("/").pop() ?? "export.json",
        });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "export_failed";
        sendLabSafeError(res, code === "EXPORT_SANITIZE_LEAK" ? 500 : 400, code.toLowerCase());
      }
    },

    async listVisualReferences(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        const niche = url.searchParams.get("niche") ?? undefined;
        const result = service.listVisualReferences(niche);
        sendJson(res, 200, { ok: true, ...result });
      } catch {
        sendLabSafeError(res, 400, "visual_list_failed");
      }
    },

    async getVisualReference(req: IncomingMessage, res: ServerResponse): Promise<void> {
      const id = pathId(req, "/review-lab/api/visual-references/");
      if (!id) {
        sendLabSafeError(res, 400, "validation_error");
        return;
      }
      const ref = service.getVisualReference(id);
      if (!ref) {
        sendLabSafeError(res, 404, "visual_not_found");
        return;
      }
      sendJson(res, 200, { ok: true, reference: ref });
    },

    async getVisualAsset(req: IncomingMessage, res: ServerResponse): Promise<void> {
      const id = pathId(req, "/review-lab/assets/visual-references/");
      if (!id) {
        sendLabSafeError(res, 400, "validation_error");
        return;
      }
      const asset = service.resolveVisualAsset(id);
      if (!asset) {
        sendLabSafeError(res, 404, "visual_asset_not_found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": asset.contentType,
        "Content-Length": asset.buffer.length,
        "Content-Disposition": "inline",
        "Cache-Control": "no-store",
      });
      res.end(asset.buffer);
    },

    async reviewVisual(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as {
          sessionId?: string;
          referenceId?: string;
          niche?: string;
          verdict?: string;
          note?: string;
        };
        const verdicts: HumanVisualReferenceVerdict[] = [
          "USEFUL",
          "WRONG_NICHE",
          "LOW_QUALITY",
          "WOULD_NOT_USE",
          "REVIEW_RIGHTS",
        ];
        if (
          !body.sessionId ||
          !body.referenceId ||
          !body.niche ||
          !verdicts.includes(body.verdict as HumanVisualReferenceVerdict)
        ) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const review = service.addVisualReview({
          sessionId: body.sessionId,
          referenceId: body.referenceId,
          niche: body.niche,
          verdict: body.verdict as HumanVisualReferenceVerdict,
          note: body.note,
        });
        const session = service.getSession(body.sessionId)!;
        sendJson(res, 200, {
          ok: true,
          review,
          session: service.sessionView(session),
        });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "visual_review_failed";
        sendLabSafeError(res, 400, code.toLowerCase());
      }
    },

    async calibrationInbox(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        const filters: Record<string, string | undefined> = {};
        for (const key of [
          "verdict",
          "intent",
          "askedField",
          "copyId",
          "code",
          "scenario",
          "visualNiche",
          "styleVersion",
          "minScore",
        ]) {
          filters[key] = url.searchParams.get(key) ?? undefined;
        }
        sendJson(res, 200, { ok: true, ...calibration.getInbox(filters) });
      } catch {
        sendLabSafeError(res, 400, "calibration_inbox_failed");
      }
    },

    async calibrationIngest(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as {
          sessionId?: string;
          redact?: boolean;
        };
        if (!body.sessionId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const session = service.getSession(body.sessionId);
        if (!session) {
          sendLabSafeError(res, 404, "session_not_found");
          return;
        }
        const payload = sanitizeLabSessionExport(session);
        const result = calibration.ingestSessionExport(payload, body.redact === true);
        sendJson(res, 200, {
          ok: true,
          itemsAdded: result.itemsAdded,
          visualAdded: result.visualAdded,
          sessionId: result.sessionId,
        });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "ingest_failed";
        sendLabSafeError(res, 400, code.toLowerCase());
      }
    },

    async calibrationSetCode(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as {
          itemId?: string;
          code?: string;
        };
        if (!body.itemId || !body.code) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const item = calibration.setItemCode(body.itemId, body.code);
        sendJson(res, 200, { ok: true, item });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "code_failed";
        sendLabSafeError(res, 400, code.toLowerCase());
      }
    },

    async calibrationCopyProposal(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as {
          copyId?: string;
          action?: string;
          proposedText?: string;
          reason?: string;
          evidenceItemIds?: string[];
          approve?: boolean;
        };
        if (!body.copyId || !body.action || !body.reason) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        let proposal = calibration.createCopyProposal({
          copyId: body.copyId,
          action: body.action as "EDIT" | "DISABLE" | "KEEP" | "ADD_VARIANT" | "REVIEW_CONTEXT",
          proposedText: body.proposedText,
          reason: body.reason,
          evidenceItemIds: body.evidenceItemIds ?? [],
        });
        if (body.approve) {
          proposal = calibration.approveCopyProposal(proposal.id);
        }
        sendJson(res, 200, { ok: true, proposal });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "proposal_failed";
        sendLabSafeError(res, 400, code.toLowerCase());
      }
    },

    async calibrationSimulate(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as { proposalId?: string };
        if (!body.proposalId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const result = await calibration.simulateProposal(body.proposalId);
        sendJson(res, 200, { ok: true, simulation: result });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "simulate_failed";
        sendLabSafeError(res, 400, code.toLowerCase());
      }
    },

    async calibrationProposeGolden(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as { itemId?: string };
        if (!body.itemId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const proposal = calibration.proposeGolden(body.itemId);
        sendJson(res, 200, { ok: true, proposal });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "golden_propose_failed";
        sendLabSafeError(res, 400, code.toLowerCase());
      }
    },

    async calibrationConfirmGolden(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as { proposalId?: string };
        if (!body.proposalId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const golden = calibration.confirmGolden(body.proposalId);
        sendJson(res, 200, { ok: true, golden });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "golden_confirm_failed";
        sendLabSafeError(res, 400, code.toLowerCase());
      }
    },

    async calibrationGenerateCandidates(
      _req: IncomingMessage,
      res: ServerResponse,
    ): Promise<void> {
      try {
        const candidates = calibration.generateCandidates();
        sendJson(res, 200, { ok: true, candidates });
      } catch {
        sendLabSafeError(res, 400, "candidates_failed");
      }
    },

    async calibrationExport(_req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const result = calibration.exportReport();
        sendJson(res, 200, {
          ok: true,
          fileName: result.fileName,
          export: result.export,
        });
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : "calibration_export_failed";
        sendLabSafeError(res, 500, code.toLowerCase());
      }
    },

    async pricingReviewGet(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        const sessionId = url.searchParams.get("sessionId") ?? undefined;
        if (!sessionId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const session = service.getSession(sessionId);
        if (!session) {
          sendLabSafeError(res, 404, "session_not_found");
          return;
        }
        const result = await pricingReview.getReview(session);
        sendJson(res, 200, {
          ok: true,
          review: result.review,
          comparison: result.comparison,
          configSource: result.configSource,
          syntheticBanner: result.syntheticBanner,
          humanReviews: pricingReview.listHumanReviews(sessionId),
        });
      } catch {
        sendLabSafeError(res, 400, "pricing_review_failed");
      }
    },

    async pricingReviewCalculate(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as {
          sessionId?: string;
          showInternalAmounts?: boolean;
          allowSynthetic?: boolean;
        };
        const sessionId = asString(body.sessionId);
        if (!sessionId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const session = service.getSession(sessionId);
        if (!session) {
          sendLabSafeError(res, 404, "session_not_found");
          return;
        }
        if (typeof body.showInternalAmounts === "boolean") {
          pricingReview.setAmountsVisible(sessionId, body.showInternalAmounts);
        }
        if (typeof body.allowSynthetic === "boolean") {
          pricingReview.setAllowSynthetic(sessionId, body.allowSynthetic);
        }
        const result = await pricingReview.calculate(session);
        sendJson(res, 200, {
          ok: true,
          review: result.review,
          syntheticBanner: result.syntheticBanner,
          comparison: result.comparison,
          configSource: result.configSource,
        });
      } catch {
        sendLabSafeError(res, 400, "pricing_review_calculate_failed");
      }
    },

    async pricingReviewExplain(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as { sessionId?: string };
        const sessionId = asString(body.sessionId);
        if (!sessionId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const session = service.getSession(sessionId);
        if (!session) {
          sendLabSafeError(res, 404, "session_not_found");
          return;
        }
        const result = await pricingReview.explain(session);
        sendJson(res, 200, { ok: true, ...result });
      } catch {
        sendLabSafeError(res, 400, "pricing_review_explain_failed");
      }
    },

    async pricingReviewHuman(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as {
          sessionId?: string;
          verdict?: string;
          code?: string;
          note?: string;
        };
        const sessionId = asString(body.sessionId);
        const verdict = asString(body.verdict) as
          | PricingExplanationReviewVerdict
          | undefined;
        if (
          !sessionId ||
          !verdict ||
          !["APPROVED", "NEEDS_ADJUSTMENT", "INCORRECT"].includes(verdict)
        ) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const session = service.getSession(sessionId);
        if (!session) {
          sendLabSafeError(res, 404, "session_not_found");
          return;
        }
        const entry = pricingReview.reviewExplanation(session, {
          verdict,
          code: asString(body.code) as PricingExplanationReviewCode | undefined,
          note: asString(body.note),
        });
        calibration.ingestPricingExplanationReview(entry);
        sendJson(res, 200, { ok: true, review: entry });
      } catch {
        sendLabSafeError(res, 400, "pricing_review_human_failed");
      }
    },

    async pricingReviewExport(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = (await readJsonBody(req)) as { sessionId?: string };
        const sessionId = asString(body.sessionId);
        if (!sessionId) {
          sendLabSafeError(res, 400, "validation_error");
          return;
        }
        const session = service.getSession(sessionId);
        if (!session) {
          sendLabSafeError(res, 404, "session_not_found");
          return;
        }
        const result = await pricingReview.exportReview(session);
        sendJson(res, 200, {
          ok: true,
          fileName: result.fileName,
          relativeHint: result.relativeHint,
        });
      } catch {
        sendLabSafeError(res, 500, "pricing_review_export_failed");
      }
    },
  };
}
