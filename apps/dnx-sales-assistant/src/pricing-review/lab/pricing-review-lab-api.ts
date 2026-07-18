import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createConversationId } from "../../conversation/create-conversation-id.js";
import type { ConversationStore } from "../../conversation/conversation-store.js";
import type { LabSession } from "../../review-lab/session/lab-models.js";
import { comparePricingExplanations } from "../comparison/compare-explanations.js";
import type {
  HumanPricingExplanationReview,
  PricingExplanationReviewCode,
  PricingExplanationReviewVerdict,
} from "../domain/pricing-review-models.js";
import { runPricingReview } from "../adapters/run-pricing-review.js";
import {
  sanitizePricingReviewExport,
  sanitizePricingReviewForLab,
  type PricingReviewLabPayload,
} from "../sanitization/sanitize-pricing-review.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LOCAL_PRICING_REVIEW_DIR = path.resolve(
  __dirname,
  "../../../.local/pricing-review",
);

const SYNTHETIC_BANNER =
  "PERFIL SINTÉTICO DE PRUEBA\n\nEstos importes no corresponden al perfil real de Dani y no deben utilizarse para cotizar.";

export type PricingReviewSessionState = {
  amountsVisible: boolean;
  /** Solo lab: opt-in explícito. */
  allowSynthetic: boolean;
  lastReview?: PricingReviewLabPayload;
  humanReviews: HumanPricingExplanationReview[];
};

const sessionState = new Map<string, PricingReviewSessionState>();

function getState(sessionId: string): PricingReviewSessionState {
  let state = sessionState.get(sessionId);
  if (!state) {
    state = {
      amountsVisible: false,
      allowSynthetic: process.env.DNX_PRICING_REVIEW_ALLOW_SYNTHETIC === "true",
      humanReviews: [],
    };
    sessionState.set(sessionId, state);
  }
  return state;
}

async function resolveFullReview(
  draft: Parameters<typeof runPricingReview>[0]["draft"],
  amountsVisible: boolean,
  allowSynthetic: boolean,
) {
  const disk = await runPricingReview({ draft, amountsVisible });
  if (disk.review.status !== "NOT_CONFIGURED") {
    return disk;
  }
  if (!allowSynthetic) {
    return disk;
  }
  return runPricingReview({
    draft,
    amountsVisible,
    useSynthetic: true,
  });
}

export class PricingReviewLabApi {
  constructor(private readonly store: ConversationStore) {}

  resetSession(sessionId: string): void {
    sessionState.delete(sessionId);
  }

  setAmountsVisible(sessionId: string, visible: boolean): void {
    getState(sessionId).amountsVisible = visible === true;
  }

  setAllowSynthetic(sessionId: string, allow: boolean): void {
    getState(sessionId).allowSynthetic = allow === true;
  }

  async getReview(session: LabSession): Promise<{
    review: PricingReviewLabPayload;
    comparison?: ReturnType<typeof comparePricingExplanations>;
    configSource: string;
    syntheticBanner?: string;
  }> {
    return this.calculate(session);
  }

  async calculate(session: LabSession): Promise<{
    review: PricingReviewLabPayload;
    comparison?: ReturnType<typeof comparePricingExplanations>;
    configSource: string;
    syntheticBanner?: string;
  }> {
    const state = getState(session.id);
    const conversationId = createConversationId(session.participantFrom);
    const stored = await this.store.get(conversationId);
    const draft = stored?.quoteRequestDraft;

    const full = await resolveFullReview(
      draft,
      state.amountsVisible,
      state.allowSynthetic,
    );
    const safe = sanitizePricingReviewForLab(full.review, {
      revealAmounts: state.amountsVisible,
    });
    let syntheticBanner: string | undefined;
    if (full.usedSynthetic) {
      syntheticBanner = SYNTHETIC_BANNER;
      safe.warnings = [
        {
          code: "USING_SYNTHETIC_PROFILE",
          message: SYNTHETIC_BANNER,
          severity: "WARNING",
        },
        ...safe.warnings,
      ];
    }
    state.lastReview = safe;

    const comparison = comparePricingExplanations({
      structured: safe.explanationStructured,
      dani: safe.explanationDani,
      componentNames: safe.components.map((c) => c.name),
      assumptionLabels: safe.assumptions.map((a) => a.label),
      missingLabels: safe.missingInformation.map((m) => m.label),
    });

    return {
      review: safe,
      comparison,
      configSource: full.configSource,
      syntheticBanner,
    };
  }

  async explain(session: LabSession): Promise<{
    explanationDani: string;
    explanationStructured: string;
    explanationVersion: string;
    comparison: ReturnType<typeof comparePricingExplanations>;
    syntheticBanner?: string;
  }> {
    const { review, comparison, syntheticBanner } = await this.calculate(session);
    return {
      explanationDani: review.explanationDani,
      explanationStructured: review.explanationStructured,
      explanationVersion: review.explanationVersion,
      comparison: comparison!,
      syntheticBanner,
    };
  }

  reviewExplanation(
    session: LabSession,
    input: {
      verdict: PricingExplanationReviewVerdict;
      code?: PricingExplanationReviewCode;
      note?: string;
    },
  ): HumanPricingExplanationReview {
    const state = getState(session.id);
    if (input.verdict === "APPROVED" && state.lastReview) {
      const usedSyntheticWarning = state.lastReview.warnings.some(
        (w) => w.code === "USING_SYNTHETIC_PROFILE",
      );
      if (usedSyntheticWarning) {
        throw new Error("SYNTHETIC_APPROVAL_BLOCKED");
      }
    }
    const entry: HumanPricingExplanationReview = {
      sessionId: session.id,
      verdict: input.verdict,
      code: input.code,
      note: input.note?.slice(0, 2000),
      explanationVersion: "dani-pricing-explanation-v1",
      createdAt: new Date().toISOString(),
    };
    state.humanReviews.push(entry);
    return entry;
  }

  listHumanReviews(sessionId: string): HumanPricingExplanationReview[] {
    return [...getState(sessionId).humanReviews];
  }

  async exportReview(session: LabSession): Promise<{
    fileName: string;
    relativeHint: string;
  }> {
    const state = getState(session.id);
    const conversationId = createConversationId(session.participantFrom);
    const stored = await this.store.get(conversationId);
    const full = await resolveFullReview(
      stored?.quoteRequestDraft,
      true,
      state.allowSynthetic,
    );

    if (full.usedSynthetic) {
      throw new Error("SYNTHETIC_EXPORT_BLOCKED");
    }

    const payload = sanitizePricingReviewExport({
      review: { ...full.review, amountsVisible: true },
      humanReview: state.humanReviews[state.humanReviews.length - 1],
      sessionId: session.id,
      scenarioId: session.scenarioId,
    });

    await mkdir(LOCAL_PRICING_REVIEW_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `pricing-review-${stamp}.json`;
    const filePath = path.join(LOCAL_PRICING_REVIEW_DIR, fileName);
    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return {
      fileName,
      relativeHint: `.local/pricing-review/${fileName}`,
    };
  }
}
