import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createConversationId } from "../conversation/create-conversation-id.js";
import type { ConversationContext } from "../models/assistant.js";
import { processMessage } from "./message-processor.js";

function ctx(normalizedText: string, from = "5493411234567"): ConversationContext {
  return {
    conversationId: createConversationId(from),
    channel: "simulate",
    participantFrom: from,
    originalText: normalizedText,
    normalizedText,
    createdAt: "2026-07-17T19:00:00.000Z",
  };
}

const clock = {
  now: () => new Date("2026-07-17T19:00:00.000Z"),
  nextExpiresAt: () => "2026-07-17T19:30:00.000Z",
};

describe("processMessage", () => {
  it("QUOTE_REQUEST inicia recolección", () => {
    const result = processMessage(ctx("Quiero presupuesto para un casamiento"), undefined, clock);
    assert.equal(result.intent, "QUOTE_REQUEST");
    assert.equal(result.quoteRequest?.draft.serviceType, "WEDDING");
    assert.equal(result.memory.status, "ACTIVE");
  });

  it("GREETING no incluye quoteRequest", () => {
    const result = processMessage(ctx("Hola"), undefined, clock);
    assert.equal(result.intent, "GREETING");
    assert.equal(result.quoteRequest, undefined);
  });
});
