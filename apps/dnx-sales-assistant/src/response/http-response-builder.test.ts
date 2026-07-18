import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AssistantResponse } from "../models/assistant.js";
import { buildHttpResponseFromAssistant } from "./http-response-builder.js";

describe("buildHttpResponseFromAssistant", () => {
  it("no expone remitente, mensaje ni conversationId", () => {
    const conversationId = "abc123def456".repeat(4);
    const assistantResponse: AssistantResponse = {
      status: "ACKNOWLEDGED",
      intent: "QUOTE_REQUEST",
      text: "¿Para qué fecha necesitás el servicio?",
      requiresHuman: false,
      context: {
        conversationId,
        channel: "simulate",
        participantFrom: "5493411234567",
        originalText: "secreto",
        normalizedText: "secreto",
        createdAt: "2026-07-17T19:00:00.000Z",
      },
      memory: {
        conversationId,
        isNewConversation: false,
        status: "ACTIVE",
        activeFlow: "QUOTE_REQUEST",
        expiresAt: "2026-07-17T19:30:00.000Z",
      },
      quoteRequest: {
        status: "COLLECTING_INFORMATION",
        draft: { serviceType: "WEDDING", city: "Córdoba" },
        missingFields: ["EVENT_DATE", "DURATION_HOURS"],
        nextQuestion: "¿Para qué fecha necesitás el servicio?",
        warnings: [],
      },
    };

    const body = buildHttpResponseFromAssistant(
      { mode: "simulate", serviceName: "dnx-sales-assistant", version: "0.1.0" },
      assistantResponse,
      "2026-07-17T19:00:00.000Z",
    );

    const raw = JSON.stringify(body);
    assert.equal(raw.includes("5493411234567"), false);
    assert.equal(raw.includes("secreto"), false);
    assert.equal(raw.includes(conversationId), false);
    assert.equal("conversationId" in (body.conversation ?? {}), false);
    assert.equal(body.conversation?.status, "ACTIVE");
    assert.equal(body.classification.intent, "QUOTE_REQUEST");
  });
});
