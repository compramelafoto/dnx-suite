import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createConversationContext } from "../../conversation/create-context.js";
import { createConversationId } from "../../conversation/create-conversation-id.js";
import { normalizeMessageText } from "../../conversation/normalize-text.js";
import type { ConversationStyleEngine } from "../../conversation/style/conversation-style-engine.js";
import { DANI_CONVERSATION_VERSION } from "../../conversation/style/dani-v1/dani-response-context.js";
import type { StoredConversation } from "../../conversation/memory-models.js";
import { evaluateDaniStyle } from "../../evaluation/dani-style/evaluate-dani-style.js";
import { knownFieldsFromDraft } from "../../evaluation/metrics/compute-conversation-metrics.js";
import { runConversationScenario } from "../../evaluation/conversation-runner/run-conversation-scenario.js";
import {
  CONVERSATION_SCENARIOS,
  getScenarioById,
} from "../../evaluation/scenarios/catalog.js";
import type { AssistantRequest } from "../../models/assistant.js";
import { processIncomingMessage } from "../../pipeline/process-incoming-message.js";
import { processMessage } from "../../processor/message-processor.js";
import type { AppDeps } from "../../types/app-deps.js";
import {
  buildSummary,
  sanitizeLabSessionExport,
} from "../export/sanitize-export.js";
import { LAB_MAX_MESSAGE_CHARS, LAB_MAX_NOTE_CHARS, LAB_MAX_TURNS } from "../session/lab-limits.js";
import { buildTurnDiagnostics } from "../session/build-turn-diagnostics.js";
import type {
  HumanResponseReview,
  HumanReviewVerdict,
  HumanVisualReferenceReview,
  HumanVisualReferenceVerdict,
  LabSession,
  LabTurn,
} from "../session/lab-models.js";
import type { LabSessionStore } from "../session/lab-session-store.js";
import { LocalCuratedVisualReferenceProvider } from "../../visual-references/provider/local-curated-visual-reference-provider.js";
import { selectVisualReferences } from "../../visual-references/selection/select-visual-references.js";
import { serializePublicVisualReference } from "../../visual-references/serialization/serialize-public-visual-reference.js";
import { isVisualReferenceNiche } from "../../visual-references/domain/visual-reference-niche.js";
import { resolveAllowedAssetPath } from "../../visual-references/validation/resolve-asset-path.js";
import {
  VISUAL_REFERENCE_MIME_BY_EXT,
  VISUAL_REFERENCE_MAX_BYTES,
} from "../../visual-references/catalog/paths.js";
import { readFileSync, existsSync, statSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_REVIEW_DIR = path.resolve(__dirname, "../../../.local/review-lab");

export type ReviewLabDeps = AppDeps & {
  labSessions: LabSessionStore;
  onPricingReviewSessionReset?: (sessionId: string) => void;
};

function cloneStored(previous: StoredConversation | undefined): StoredConversation | undefined {
  if (!previous) return undefined;
  return structuredClone(previous);
}

function makeRequest(from: string, text: string): AssistantRequest {
  return {
    message: {
      from,
      text,
      channel: "simulate",
      receivedAt: new Date().toISOString(),
    },
  };
}

export class ReviewLabService {
  constructor(private readonly deps: ReviewLabDeps) {}

  listScenarios() {
    return CONVERSATION_SCENARIOS.map((s) => ({
      id: s.id,
      description: s.description,
      messageCount: s.messages.length,
      expectations: s.expectations ?? {},
    }));
  }

  createSession(styleEngine?: ConversationStyleEngine): LabSession {
    return this.deps.labSessions.create(styleEngine ?? "dani-conversation-v1");
  }

  getSession(id: string): LabSession | undefined {
    return this.deps.labSessions.get(id);
  }

  async resetSession(id: string): Promise<LabSession | undefined> {
    const session = this.deps.labSessions.get(id);
    if (!session) return undefined;
    const conversationId = createConversationId(session.participantFrom);
    await this.deps.store.delete(conversationId);
    session.turns = [];
    session.humanReviews = [];
    session.humanVisualReviews = [];
    session.scenarioId = undefined;
    session.scenarioCursor = undefined;
    this.deps.onPricingReviewSessionReset?.(session.id);
    this.deps.labSessions.save(session);
    return session;
  }

  setStyleEngine(id: string, engine: ConversationStyleEngine): LabSession | undefined {
    const session = this.deps.labSessions.get(id);
    if (!session) return undefined;
    session.styleEngine = engine;
    this.deps.labSessions.save(session);
    return session;
  }

  async postMessage(sessionId: string, message: string): Promise<{
    session: LabSession;
    turn: LabTurn;
  }> {
    const session = this.deps.labSessions.get(sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (session.turns.length >= LAB_MAX_TURNS) throw new Error("TURN_LIMIT");
    if (typeof message !== "string" || message.trim().length === 0) {
      throw new Error("MESSAGE_REQUIRED");
    }
    if (message.length > LAB_MAX_MESSAGE_CHARS) throw new Error("MESSAGE_TOO_LONG");

    const conversationId = createConversationId(session.participantFrom);
    const previous = await this.deps.store.get(conversationId);
    const previousDraft = previous?.quoteRequestDraft
      ? { ...previous.quoteRequestDraft }
      : undefined;

    const response = await processIncomingMessage(
      makeRequest(session.participantFrom, message),
      {
        store: this.deps.store,
        memoryClock: this.deps.memoryClock,
        pricingRuntime: this.deps.pricingRuntime,
        styleEngine: session.styleEngine,
      },
    );

    const diagnostics = await buildTurnDiagnostics({
      session,
      userMessage: message,
      response,
      previousDraft,
      store: this.deps.store,
      styleEngine: session.styleEngine,
      styleVersion:
        session.styleEngine === "dani-conversation-v1"
          ? DANI_CONVERSATION_VERSION
          : "legacy",
      appliedCopyIds: response.appliedCopyIds,
      responseType: response.responseType,
    });

    // Infer asked field from missing / next question heuristics
    if (!diagnostics.askedField && diagnostics.missingFields[0]) {
      diagnostics.askedField = diagnostics.missingFields[0];
    }

    const turn: LabTurn = {
      turnNumber: session.turns.length + 1,
      userMessage: message,
      assistantMessage: response.text,
      diagnostics,
    };
    session.turns.push(turn);
    this.deps.labSessions.save(session);
    return { session, turn };
  }

  async compare(sessionId: string, message: string): Promise<{
    legacy: { text: string; score: number; flags: string[]; askedField?: string };
    dani: { text: string; score: number; flags: string[]; askedField?: string };
    flagsRemoved: string[];
    flagsIntroduced: string[];
  }> {
    const session = this.deps.labSessions.get(sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (typeof message !== "string" || message.trim().length === 0) {
      throw new Error("MESSAGE_REQUIRED");
    }
    if (message.length > LAB_MAX_MESSAGE_CHARS) throw new Error("MESSAGE_TOO_LONG");

    const conversationId = createConversationId(session.participantFrom);
    const previous = await this.deps.store.get(conversationId);
    const normalized = normalizeMessageText(message);
    const context = createConversationContext(
      {
        from: session.participantFrom,
        text: message,
        channel: "simulate",
        receivedAt: new Date().toISOString(),
      },
      normalized,
      conversationId,
    );
    const clock = {
      now: () => this.deps.memoryClock.now(),
      nextExpiresAt: (from?: Date) => this.deps.memoryClock.nextExpiresAt(from),
    };

    const legacyResult = processMessage(
      context,
      cloneStored(previous),
      clock,
      { styleEngine: "legacy" },
    );
    const daniResult = processMessage(
      context,
      cloneStored(previous),
      clock,
      { styleEngine: "dani-conversation-v1" },
    );

    const scoreOne = (text: string) => {
      const transcript = {
        scenarioId: "compare",
        turns: [
          {
            turnNumber: 1,
            userMessage: message,
            assistantMessage: text,
            extractedFields: [] as import("../../quote-request/models.js").QuoteRequiredField[],
            missingFields: [] as import("../../quote-request/models.js").QuoteRequiredField[],
            conversationStatus: "ACTIVE",
            warnings: [] as string[],
          },
        ],
        final: {
          conversationStatus: "ACTIVE",
          missingFields: [] as string[],
        },
      };
      return evaluateDaniStyle(transcript, [
        knownFieldsFromDraft(previous?.quoteRequestDraft),
      ]);
    };

    const legacyStyle = scoreOne(legacyResult.text);
    const daniStyle = scoreOne(daniResult.text);
    const legacyFlags = legacyStyle.flags.map((f) => f.code);
    const daniFlags = daniStyle.flags.map((f) => f.code);

    return {
      legacy: {
        text: legacyResult.text,
        score: legacyStyle.score,
        flags: legacyFlags,
        askedField: legacyResult.quoteRequest?.missingFields[0],
      },
      dani: {
        text: daniResult.text,
        score: daniStyle.score,
        flags: daniFlags,
        askedField: daniResult.quoteRequest?.missingFields[0],
      },
      flagsRemoved: legacyFlags.filter((c) => !daniFlags.includes(c)),
      flagsIntroduced: daniFlags.filter((c) => !legacyFlags.includes(c)),
    };
  }

  async loadScenario(sessionId: string, scenarioId: string): Promise<LabSession> {
    const session = await this.resetSession(sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    const scenario = getScenarioById(scenarioId);
    if (!scenario) throw new Error("SCENARIO_NOT_FOUND");
    session.scenarioId = scenarioId;
    session.scenarioCursor = 0;
    this.deps.labSessions.save(session);
    return session;
  }

  async runScenarioStep(sessionId: string): Promise<{
    session: LabSession;
    turn?: LabTurn;
    done: boolean;
    scenarioResult?: { passed: boolean; score: number };
  }> {
    const session = this.deps.labSessions.get(sessionId);
    if (!session?.scenarioId) throw new Error("SCENARIO_NOT_LOADED");
    const scenario = getScenarioById(session.scenarioId);
    if (!scenario) throw new Error("SCENARIO_NOT_FOUND");
    const cursor = session.scenarioCursor ?? 0;
    if (cursor >= scenario.messages.length) {
      return { session, done: true };
    }
    const message = scenario.messages[cursor]!;
    const { turn } = await this.postMessage(sessionId, message);
    const updated = this.deps.labSessions.get(sessionId)!;
    updated.scenarioCursor = cursor + 1;
    this.deps.labSessions.save(updated);
    const done = (updated.scenarioCursor ?? 0) >= scenario.messages.length;
    return { session: updated, turn, done };
  }

  async runScenarioAll(sessionId: string): Promise<{
    session: LabSession;
    passed: boolean;
    score: number;
    expectationFailures: string[];
  }> {
    const session = this.deps.labSessions.get(sessionId);
    if (!session?.scenarioId) throw new Error("SCENARIO_NOT_LOADED");
    const scenario = getScenarioById(session.scenarioId);
    if (!scenario) throw new Error("SCENARIO_NOT_FOUND");

    await this.resetSession(sessionId);
    const fresh = this.deps.labSessions.get(sessionId)!;
    fresh.scenarioId = scenario.id;
    fresh.scenarioCursor = 0;
    this.deps.labSessions.save(fresh);

    for (const msg of scenario.messages) {
      await this.postMessage(sessionId, msg);
    }

    const offline = await runConversationScenario(scenario, {
      styleEngine: fresh.styleEngine,
      from: `5498${sessionId.replace(/\D/g, "").slice(0, 9) || "123456789"}`,
    });

    const updated = this.deps.labSessions.get(sessionId)!;
    updated.scenarioCursor = scenario.messages.length;
    this.deps.labSessions.save(updated);

    return {
      session: updated,
      passed: offline.passed,
      score: offline.daniStyle.score,
      expectationFailures: offline.expectationFailures.map(
        (f) => `[${f.code}] ${f.message}`,
      ),
    };
  }

  listVisualReferences(niche?: string) {
    const provider = new LocalCuratedVisualReferenceProvider();
    if (niche && isVisualReferenceNiche(niche)) {
      const selection = selectVisualReferences({
        niche,
        references: provider.listApprovedSync(),
      });
      return {
        provider: "LOCAL_CURATED" as const,
        niche,
        authorizedCount: selection.availableCount,
        references: selection.selected.map(serializePublicVisualReference),
      };
    }
    const all = provider.listApprovedSync().map(serializePublicVisualReference);
    return {
      provider: "LOCAL_CURATED" as const,
      authorizedCount: all.length,
      references: all.slice(0, 6),
    };
  }

  getVisualReference(id: string) {
    const provider = new LocalCuratedVisualReferenceProvider();
    const ref = provider.listApprovedSync().find((r) => r.id === id);
    return ref ? serializePublicVisualReference(ref) : null;
  }

  resolveVisualAsset(id: string): {
    buffer: Buffer;
    contentType: string;
  } | null {
    const provider = new LocalCuratedVisualReferenceProvider();
    const refs = provider.listApprovedSync();
    const ref = refs.find((r) => r.id === id);
    if (!ref) return null;
    const resolved = resolveAllowedAssetPath(ref.imagePath);
    if (!resolved.ok) return null;
    if (!existsSync(resolved.absolutePath)) return null;
    const size = statSync(resolved.absolutePath).size;
    if (size > VISUAL_REFERENCE_MAX_BYTES) return null;
    const contentType = VISUAL_REFERENCE_MIME_BY_EXT[resolved.ext];
    if (!contentType) return null;
    return {
      buffer: readFileSync(resolved.absolutePath),
      contentType,
    };
  }

  addVisualReview(input: {
    sessionId: string;
    referenceId: string;
    niche: string;
    verdict: HumanVisualReferenceVerdict;
    note?: string;
  }): HumanVisualReferenceReview {
    const session = this.deps.labSessions.get(input.sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (input.note && input.note.length > LAB_MAX_NOTE_CHARS) {
      throw new Error("NOTE_TOO_LONG");
    }
    const review: HumanVisualReferenceReview = {
      sessionId: session.id,
      referenceId: input.referenceId,
      niche: input.niche,
      verdict: input.verdict,
      note: input.note?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    session.humanVisualReviews = session.humanVisualReviews.filter(
      (r) => r.referenceId !== input.referenceId,
    );
    session.humanVisualReviews.push(review);
    this.deps.labSessions.save(session);
    return review;
  }

  addReview(input: {
    sessionId: string;
    turnNumber: number;
    verdict: HumanReviewVerdict;
    note?: string;
  }): HumanResponseReview {
    const session = this.deps.labSessions.get(input.sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    const turn = session.turns.find((t) => t.turnNumber === input.turnNumber);
    if (!turn) throw new Error("TURN_NOT_FOUND");
    if (input.note && input.note.length > LAB_MAX_NOTE_CHARS) {
      throw new Error("NOTE_TOO_LONG");
    }

    const review: HumanResponseReview = {
      conversationId: session.id,
      turnNumber: input.turnNumber,
      verdict: input.verdict,
      note: input.note?.trim() || undefined,
      assistantMessage: turn.assistantMessage,
      styleVersion: turn.diagnostics.styleVersion ?? session.styleEngine,
      askedField: turn.diagnostics.askedField,
      createdAt: new Date().toISOString(),
    };
    turn.humanReview = review;
    session.humanReviews = session.humanReviews.filter(
      (r) => r.turnNumber !== input.turnNumber,
    );
    session.humanReviews.push(review);
    this.deps.labSessions.save(session);
    return review;
  }

  async exportSession(sessionId: string): Promise<{
    payload: Record<string, unknown>;
    filePath: string;
  }> {
    const session = this.deps.labSessions.get(sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    const payload = sanitizeLabSessionExport(session);
    await mkdir(LOCAL_REVIEW_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path.join(LOCAL_REVIEW_DIR, `review-session-${stamp}.json`);
    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return { payload, filePath };
  }

  sessionView(session: LabSession) {
    return {
      id: session.id,
      styleEngine: session.styleEngine,
      scenarioId: session.scenarioId,
      scenarioCursor: session.scenarioCursor,
      turns: session.turns,
      humanReviews: session.humanReviews,
      humanVisualReviews: session.humanVisualReviews,
      summary: buildSummary(session),
      disclaimer:
        "La evaluación automática orienta la revisión. La aprobación final es de Dani.",
    };
  }

  get localReviewDir(): string {
    return LOCAL_REVIEW_DIR;
  }
}
