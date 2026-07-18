import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryConversationStore } from "../conversation/in-memory-conversation-store.js";
import type { AssistantRequest } from "../models/assistant.js";
import { processIncomingMessage } from "../pipeline/process-incoming-message.js";
import { buildHttpResponseFromAssistant } from "../response/http-response-builder.js";

/**
 * Estabilidad del contrato HTTP tras dani-conversation-v1.
 * No exige frase legacy exacta; sí ausencia de precios y READY.
 */
describe("HTTP stability (dani-conversation-v1)", () => {
  it("READY responde sin precios ni breakdown", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    const request: AssistantRequest = {
      message: {
        from: "5493419990001",
        text: "Quiero presupuesto para un casamiento en Rosario el 20 de noviembre de 2026 y voy a cubrir ocho horas.",
        channel: "simulate",
        receivedAt: "2026-07-17T19:00:00.000Z",
      },
    };
    const assistant = await processIncomingMessage(request, {
      store,
      memoryClock: store,
      pricingRuntime: {
        silentLogs: true,
        resolveConfig: () => ({ status: "UNAVAILABLE", reason: "stability-test" }),
      },
    });

    assert.equal(assistant.quoteRequest?.status, "READY_FOR_CALCULATION");
    assert.ok(assistant.text.length > 0);
    assert.equal(/\?/.test(assistant.text), false);
    assert.equal(
      /recommendedBusiness|breakdown|hourlyRate|READY_FOR_CALCULATION|pricing/i.test(
        assistant.text,
      ),
      false,
    );

    const body = buildHttpResponseFromAssistant(
      { mode: "simulate", serviceName: "dnx-sales-assistant", version: "0.1.0" },
      assistant,
      "2026-07-17T19:00:00.000Z",
    );
    const raw = JSON.stringify(body);
    assert.equal(/recommendedBusiness|breakdown|hourlyRate|\$\d|ARS\s*\d/i.test(raw), false);
    assert.equal(body.reply.text, assistant.text);
  });
});
