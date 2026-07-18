import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  containsSensitiveLeak,
  sanitizeLabSessionExport,
} from "./sanitize-export.js";
import type { LabSession } from "../session/lab-models.js";

describe("sanitizeLabSessionExport", () => {
  it("exporta sin precios ni breakdown", () => {
    const session: LabSession = {
      id: "s1",
      createdAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z",
      expiresAt: "2026-07-18T02:00:00.000Z",
      participantFrom: "lab123",
      styleEngine: "dani-conversation-v1",
      turns: [
        {
          turnNumber: 1,
          userMessage: "Che, me salió un casamiento.",
          assistantMessage: "¿Cuándo sería?",
          diagnostics: {
            intent: "QUOTE_REQUEST",
            conversationStatus: "ACTIVE",
            quoteStatus: "COLLECTING_INFORMATION",
            knownFields: ["SERVICE_TYPE"],
            fieldsLearnedThisTurn: ["SERVICE_TYPE"],
            correctedFields: [],
            missingFields: ["EVENT_DATE", "CITY", "DURATION_HOURS"],
            askedField: "EVENT_DATE",
            styleEngine: "dani-conversation-v1",
            styleVersion: "dani-conversation-v1",
            daniScore: 100,
            flags: [],
            pricingRuntimeStatus: "NOT_RUN",
            visualReferenceRequested: false,
          },
        },
      ],
      humanReviews: [
        {
          conversationId: "s1",
          turnNumber: 1,
          verdict: "APPROVED",
          note: "Está perfecta.",
          assistantMessage: "¿Cuándo sería?",
          styleVersion: "dani-conversation-v1",
          askedField: "EVENT_DATE",
          createdAt: "2026-07-18T00:01:00.000Z",
        },
      ],
      humanVisualReviews: [],
    };

    const payload = sanitizeLabSessionExport(session);
    const raw = JSON.stringify(payload);
    assert.equal(containsSensitiveLeak(raw), false);
    assert.equal(/recommendedBusiness|breakdown|hourlyRate/i.test(raw), false);
    assert.equal((payload.humanReviews as unknown[]).length, 1);
  });

  it("detecta fugas sensibles", () => {
    assert.equal(containsSensitiveLeak('{"breakdown":1}'), true);
    assert.equal(containsSensitiveLeak('{"API_KEY":"x"}'), true);
    assert.equal(containsSensitiveLeak('{"score":100}'), false);
  });
});
