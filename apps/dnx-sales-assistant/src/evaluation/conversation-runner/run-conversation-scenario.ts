/**
 * Runner offline — invoca el pipeline real (processIncomingMessage), sin HTTP.
 */
import { createConversationId } from "../../conversation/create-conversation-id.js";
import { InMemoryConversationStore } from "../../conversation/in-memory-conversation-store.js";
import type { AssistantRequest } from "../../models/assistant.js";
import { processIncomingMessage } from "../../pipeline/process-incoming-message.js";
import {
  createSyntheticReadyCatalog,
  createSyntheticReadyProfile,
} from "../../pricing/__fixtures__/synthetic-ready.js";
import { createInlinePricingRuntimeConfigResolver } from "../../pricing/runtime/resolve-pricing-runtime-config.js";
import type { PricingRuntimeDeps } from "../../pricing/runtime/pricing-runtime.js";
import type { ConversationStyleEngine } from "../../conversation/style/conversation-style-engine.js";
import type {
  QuoteRequestDraft,
  QuoteRequiredField,
} from "../../quote-request/models.js";
import type { ConversationTurnTrace } from "../conversation-transcript/conversation-turn.js";
import type { ConversationTranscript } from "../conversation-transcript/conversation-transcript.js";
import { evaluateDaniStyle } from "../dani-style/evaluate-dani-style.js";
import {
  computeConversationMetrics,
  knownFieldsFromDraft,
} from "../metrics/compute-conversation-metrics.js";
import { detectVisualReferenceIntent } from "../visual-reference/detect-visual-reference-intent.js";
import { checkExpectations } from "./check-expectations.js";
import type { ConversationRunResult } from "./conversation-run-result.js";
import type { ConversationScenario } from "./conversation-scenario.js";

function makeRequest(text: string, from: string): AssistantRequest {
  return {
    message: {
      from,
      text,
      channel: "simulate",
      receivedAt: new Date().toISOString(),
    },
  };
}

function defaultPricingRuntime(enableSynthetic: boolean): PricingRuntimeDeps {
  if (!enableSynthetic) {
    return {
      silentLogs: true,
      resolveConfig: () => ({ status: "UNAVAILABLE", reason: "eval-no-config" }),
    };
  }
  return {
    silentLogs: true,
    resolveConfig: createInlinePricingRuntimeConfigResolver({
      profile: createSyntheticReadyProfile(),
      catalog: createSyntheticReadyCatalog(),
    }),
  };
}

export type RunConversationScenarioOptions = {
  /** Remitente sintético único por corrida. */
  from?: string;
  /** Usar perfil/catálogo sintético para poder obtener pricing READY. */
  syntheticPricing?: boolean;
  /** Forzar motor de estilo (compare legacy vs Dani). */
  styleEngine?: ConversationStyleEngine;
};

export async function runConversationScenario(
  scenario: ConversationScenario,
  options: RunConversationScenarioOptions = {},
): Promise<ConversationRunResult> {
  const from = options.from ?? `5493${Math.abs(hashId(scenario.id) % 1_000_000_000)}`;
  const syntheticPricing =
    options.syntheticPricing ??
    (Boolean(scenario.expectations?.expectPricingReady) ||
      Boolean(scenario.expectations?.shouldReachReadyForCalculation));

  const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
  const pricingRuntime = defaultPricingRuntime(syntheticPricing);
  const deps = {
    store,
    memoryClock: store,
    pricingRuntime,
    styleEngine: options.styleEngine,
  };

  const turns: ConversationTurnTrace[] = [];
  const knownBeforeTurn: Array<Set<QuoteRequiredField>> = [];
  let previousDraft: QuoteRequestDraft | undefined;

  for (let i = 0; i < scenario.messages.length; i += 1) {
    const userMessage = scenario.messages[i]!;
    knownBeforeTurn.push(knownFieldsFromDraft(previousDraft));

    const response = await processIncomingMessage(
      makeRequest(userMessage, from),
      deps,
    );

    const conversationId = createConversationId(from);
    const stored = await store.get(conversationId);
    const visual = detectVisualReferenceIntent(userMessage);

    const extractedFields = response.quoteRequest?.draft
      ? fieldsGained(previousDraft, response.quoteRequest.draft)
      : [];

    turns.push({
      turnNumber: i + 1,
      userMessage,
      assistantMessage: response.text,
      detectedIntent: response.intent,
      extractedFields,
      missingFields: response.quoteRequest?.missingFields ?? [],
      conversationStatus: response.memory.status,
      quoteStatus: response.quoteRequest?.status,
      pricingRuntimeStatus: stored?.pricingResult?.status,
      warnings: response.quoteRequest?.warnings ?? [],
      visualReferenceRequested: visual.requested || undefined,
      visualNiche: visual.niche,
    });

    previousDraft = response.quoteRequest?.draft
      ? { ...response.quoteRequest.draft }
      : previousDraft;
  }

  const conversationId = createConversationId(from);
  const stored = await store.get(conversationId);
  const lastTurn = turns[turns.length - 1];

  const transcript: ConversationTranscript = {
    scenarioId: scenario.id,
    turns,
    final: {
      conversationStatus: lastTurn?.conversationStatus ?? "ACTIVE",
      quoteStatus: lastTurn?.quoteStatus,
      draft: previousDraft,
      intent: lastTurn?.detectedIntent,
      missingFields: lastTurn?.missingFields ?? [],
      pricingRuntimeStatus: stored?.pricingResult?.status,
      pricingApprovalStatus: stored?.pricingResult?.approvalStatus,
    },
  };

  const metrics = computeConversationMetrics(transcript, knownBeforeTurn);
  const daniStyle = evaluateDaniStyle(transcript, knownBeforeTurn);
  const expectationFailures = checkExpectations({
    expectations: scenario.expectations,
    transcript,
    metrics,
    finalIntent: transcript.final.intent,
    daniStyle,
  });

  return {
    scenario,
    transcript,
    metrics,
    daniStyle,
    expectationFailures,
    passed: expectationFailures.length === 0,
  };
}

function fieldsGained(
  before: QuoteRequestDraft | undefined,
  after: QuoteRequestDraft,
): QuoteRequiredField[] {
  const gained: QuoteRequiredField[] = [];
  const beforeSet = knownFieldsFromDraft(before);
  const afterSet = knownFieldsFromDraft(after);
  for (const f of afterSet) {
    if (!beforeSet.has(f)) gained.push(f);
  }
  return gained;
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}
