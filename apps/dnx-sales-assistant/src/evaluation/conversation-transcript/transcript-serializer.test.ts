import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConversationTranscript } from "./conversation-transcript.js";
import {
  serializeTranscript,
  transcriptContainsPriceLeak,
} from "./transcript-serializer.js";

describe("transcript serializer", () => {
  it("serializa JSON legible sin precios", () => {
    const transcript: ConversationTranscript = {
      scenarioId: "s1",
      turns: [
        {
          turnNumber: 1,
          userMessage: "hola",
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
        pricingRuntimeStatus: "READY",
      },
    };
    const json = serializeTranscript(transcript);
    assert.ok(json.includes('"scenarioId": "s1"'));
    assert.equal(transcriptContainsPriceLeak(json), false);
  });

  it("detecta fuga de breakdown en texto", () => {
    assert.equal(
      transcriptContainsPriceLeak('{"breakdown":{"hourlyRate":10}}'),
      true,
    );
    assert.equal(
      transcriptContainsPriceLeak('{"recommendedBusinessPrice":100}'),
      true,
    );
  });
});
