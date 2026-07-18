import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConversationTranscript } from "../conversation-transcript/conversation-transcript.js";
import type { QuoteRequiredField } from "../../quote-request/models.js";
import { computeConversationMetrics } from "./compute-conversation-metrics.js";

describe("computeConversationMetrics", () => {
  it("cuenta turnos, longitud y form-like", () => {
    const transcript: ConversationTranscript = {
      scenarioId: "m",
      turns: [
        {
          turnNumber: 1,
          userMessage: "hola",
          assistantMessage: "Indique la ciudad.",
          extractedFields: [],
          missingFields: ["CITY"],
          conversationStatus: "ACTIVE",
          warnings: [],
        },
        {
          turnNumber: 2,
          userMessage: "ok",
          assistantMessage: "¿Cuándo sería?",
          extractedFields: [],
          missingFields: ["EVENT_DATE"],
          conversationStatus: "ACTIVE",
          warnings: [],
        },
      ],
      final: {
        conversationStatus: "ACTIVE",
        quoteStatus: "COLLECTING_INFORMATION",
        missingFields: ["EVENT_DATE"],
      },
    };
    const metrics = computeConversationMetrics(transcript, [
      new Set(),
      new Set(),
    ]);
    assert.equal(metrics.totalTurns, 2);
    assert.equal(metrics.formLikeMessages, 1);
    assert.equal(metrics.assistantQuestions, 1);
    assert.ok(metrics.averageAssistantMessageLength > 0);
    assert.equal(metrics.reachedReadyForCalculation, false);
  });

  it("detecta already-known field questions", () => {
    const transcript: ConversationTranscript = {
      scenarioId: "m2",
      turns: [
        {
          turnNumber: 1,
          userMessage: "Rosario",
          assistantMessage: "¿En qué ciudad o localidad se realizará?",
          extractedFields: ["CITY"],
          missingFields: [],
          conversationStatus: "ACTIVE",
          warnings: [],
        },
      ],
      final: {
        conversationStatus: "ACTIVE",
        missingFields: [],
        draft: { city: "Rosario" },
      },
    };
    const metrics = computeConversationMetrics(transcript, [
      new Set<QuoteRequiredField>(["CITY"]),
    ]);
    assert.equal(metrics.alreadyKnownFieldQuestions, 1);
  });
});
