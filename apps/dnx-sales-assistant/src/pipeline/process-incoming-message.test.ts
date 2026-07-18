import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryConversationStore } from "../conversation/in-memory-conversation-store.js";
import type { AssistantRequest } from "../models/assistant.js";
import {
  PipelineValidationError,
  processIncomingMessage,
} from "./process-incoming-message.js";

function makeRequest(text: string, from = "5493411234567"): AssistantRequest {
  return {
    message: {
      from,
      text,
      channel: "simulate",
      receivedAt: "2026-07-17T19:00:00.000Z",
    },
  };
}

async function turn(
  store: InMemoryConversationStore,
  text: string,
  from?: string,
) {
  return processIncomingMessage(makeRequest(text, from), {
    store,
    memoryClock: store,
    // Sin config local: runtime falla en silencio (no cambia respuestas).
    pricingRuntime: {
      silentLogs: true,
      resolveConfig: () => ({ status: "UNAVAILABLE", reason: "test" }),
    },
  });
}

describe("processIncomingMessage — memoria multiturno", () => {
  it("flujo completo en cuatro mensajes", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    const t1 = await turn(store, "Quiero presupuesto para un casamiento.");
    assert.equal(t1.quoteRequest?.draft.serviceType, "WEDDING");
    assert.equal(t1.quoteRequest?.missingFields[0], "EVENT_DATE");
    assert.equal(t1.memory.status, "ACTIVE");

    const t2 = await turn(store, "20/09/2026.");
    assert.equal(t2.quoteRequest?.draft.serviceType, "WEDDING");
    assert.equal(t2.quoteRequest?.draft.eventDate, "2026-09-20");
    assert.equal(t2.quoteRequest?.missingFields[0], "CITY");

    const t3 = await turn(store, "En Córdoba.");
    assert.equal(t3.quoteRequest?.draft.city, "Córdoba");
    assert.equal(t3.quoteRequest?.missingFields[0], "DURATION_HOURS");

    const t4 = await turn(store, "8 horas.");
    assert.equal(t4.quoteRequest?.status, "READY_FOR_CALCULATION");
    assert.equal(t4.memory.status, "COMPLETED");
    assert.equal(t4.quoteRequest?.draft.durationHours, 8);
  });

  it("datos en otro orden", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    await turn(store, "Quiero presupuesto en Córdoba.");
    await turn(store, "Es un cumpleaños de 15.");
    await turn(store, "El 10/12/2026.");
    const last = await turn(store, "4 horas.");
    assert.equal(last.quoteRequest?.draft.serviceType, "FIFTEENTH_BIRTHDAY");
    assert.equal(last.quoteRequest?.draft.city, "Córdoba");
    assert.equal(last.quoteRequest?.draft.eventDate, "2026-12-10");
    assert.equal(last.quoteRequest?.draft.durationHours, 4);
    assert.equal(last.quoteRequest?.status, "READY_FOR_CALCULATION");
  });

  it("corrección de fecha", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    await turn(store, "Quiero presupuesto para un casamiento.");
    await turn(store, "Es el 20/09/2026.");
    const corrected = await turn(store, "Perdón, es el 21/09/2026.");
    assert.equal(corrected.quoteRequest?.draft.eventDate, "2026-09-21");
    assert.equal(corrected.quoteRequest?.draft.serviceType, "WEDDING");
  });

  it("separa remitentes", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    await turn(store, "Quiero presupuesto para un casamiento.", "5491111111111");
    await turn(store, "Quiero presupuesto para un cumpleaños de 15.", "5492222222222");
    const a = await turn(store, "20/09/2026.", "5491111111111");
    const b = await turn(store, "En Córdoba.", "5492222222222");
    assert.equal(a.quoteRequest?.draft.serviceType, "WEDDING");
    assert.equal(a.quoteRequest?.draft.eventDate, "2026-09-20");
    assert.equal(b.quoteRequest?.draft.serviceType, "FIFTEENTH_BIRTHDAY");
    assert.equal(b.quoteRequest?.draft.city, "Córdoba");
    assert.equal(b.quoteRequest?.draft.eventDate, undefined);
  });

  it("cancelación limpia el flujo", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    await turn(store, "Quiero presupuesto para un casamiento.");
    const cancelled = await turn(store, "Cancelar presupuesto.");
    assert.match(cancelled.text, /cancel[eé].*(solicitud|presupuesto)/i);
    assert.equal(cancelled.memory.status, "COMPLETED");
    assert.equal(cancelled.quoteRequest, undefined);
  });

  it("handoff marca REQUIRES_HUMAN", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    await turn(store, "Quiero presupuesto para un casamiento.");
    const handoff = await turn(store, "Quiero hablar con Daniel.");
    assert.equal(handoff.intent, "HUMAN_HANDOFF_REQUEST");
    assert.equal(handoff.requiresHuman, true);
    assert.equal(handoff.memory.status, "REQUIRES_HUMAN");
  });

  it("expiración no recupera draft anterior", async () => {
    let now = new Date("2026-07-17T12:00:00.000Z");
    const store = new InMemoryConversationStore({
      ttlMs: 60_000,
      now: () => now,
    });
    await turn(store, "Quiero presupuesto para un casamiento.");
    now = new Date(now.getTime() + 120_000);
    const next = await turn(store, "20/09/2026.");
    // Sin flujo activo, "20/09/2026" no es QUOTE_REQUEST → UNKNOWN sin draft
    assert.equal(next.intent === "QUOTE_REQUEST", false);
    assert.equal(next.quoteRequest, undefined);
  });

  it("tras completar, Gracias no reinicia", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    await turn(store, "Quiero presupuesto para un casamiento en Córdoba el 20/09/2026 por 8 horas.");
    const thanks = await turn(store, "Gracias.");
    assert.equal(thanks.intent, "THANKS");
    assert.equal(thanks.quoteRequest, undefined);
  });

  it("nuevo presupuesto tras completar", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    await turn(store, "Quiero presupuesto para un casamiento en Córdoba el 20/09/2026 por 8 horas.");
    const neu = await turn(store, "También quiero presupuesto para un cumpleaños.");
    assert.equal(neu.intent, "QUOTE_REQUEST");
    assert.equal(neu.quoteRequest?.draft.serviceType, "BIRTHDAY");
    assert.equal(neu.memory.isNewConversation, true);
  });

  it("consulta general y saludo sin quoteRequest", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    const g = await turn(store, "¿Hacen fotografía de bodas?");
    assert.equal(g.intent, "GENERAL_SERVICE_INQUIRY");
    assert.equal(g.quoteRequest, undefined);
    const h = await turn(store, "Hola.");
    assert.equal(h.intent, "GREETING");
  });

  it("rechaza mensaje vacío", async () => {
    const store = new InMemoryConversationStore();
    await assert.rejects(
      () => turn(store, "   "),
      PipelineValidationError,
    );
  });
});
