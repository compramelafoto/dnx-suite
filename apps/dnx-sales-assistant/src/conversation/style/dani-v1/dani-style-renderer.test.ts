import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DaniResponseContext } from "./dani-response-context.js";
import { DANI_CONVERSATION_VERSION } from "./dani-response-context.js";
import { renderDaniResponse } from "./dani-style-renderer.js";
import { selectNextMissingField } from "./dani-question-strategy.js";
import { pickDeterministicCopy, stableHash } from "./dani-pick-copy.js";
import { questionCopiesForField } from "./dani-copy-catalog.js";
import { hasCriticalStyleViolation } from "./dani-style-guards.js";
import { composeConversationReply } from "../compose-conversation-reply.js";
import { renderLegacyResponse } from "../legacy/legacy-style-renderer.js";

function baseCtx(partial: Partial<DaniResponseContext>): DaniResponseContext {
  return {
    userMessage: "hola",
    detectedIntent: "QUOTE_REQUEST",
    conversationStatus: "ACTIVE",
    knownFields: [],
    fieldsLearnedThisTurn: [],
    missingFields: ["EVENT_DATE"],
    previouslyAskedFields: [],
    correctedFields: [],
    turnNumber: 1,
    previousAssistantMessages: [],
    usedCopyIds: [],
    conversationId: "conv-test-1",
    quoteStatus: "COLLECTING_INFORMATION",
    ...partial,
  };
}

describe("dani-conversation-v1 renderer", () => {
  it("una sola pregunta y versión interna", () => {
    const result = renderDaniResponse(baseCtx({}));
    assert.equal(result.styleVersion, DANI_CONVERSATION_VERSION);
    assert.equal((result.message.match(/\?/g) ?? []).length, 1);
    assert.equal(result.askedField, "EVENT_DATE");
  });

  it("no pregunta campos conocidos / selecciona siguiente faltante", () => {
    assert.equal(
      selectNextMissingField(["CITY", "DURATION_HOURS", "EVENT_DATE"]),
      "EVENT_DATE",
    );
    const result = renderDaniResponse(
      baseCtx({
        knownFields: ["SERVICE_TYPE", "CITY"],
        missingFields: ["EVENT_DATE", "DURATION_HOURS"],
        draft: { serviceType: "WEDDING", city: "Rosario" },
        fieldsLearnedThisTurn: ["CITY"],
      }),
    );
    assert.equal(result.askedField, "EVENT_DATE");
    assert.equal(/ciudad|dónde|localidad/i.test(result.message) && /rosario/i.test(result.message), false);
  });

  it("READY_INTERNAL sin precios ni estados técnicos", () => {
    const result = renderDaniResponse(
      baseCtx({
        missingFields: [],
        quoteStatus: "READY_FOR_CALCULATION",
        knownFields: ["SERVICE_TYPE", "EVENT_DATE", "CITY", "DURATION_HOURS"],
        fieldsLearnedThisTurn: ["DURATION_HOURS"],
        draft: {
          serviceType: "WEDDING",
          eventDate: "2026-11-20",
          city: "Rosario",
          durationHours: 8,
        },
      }),
    );
    assert.equal(result.responseType, "READY_INTERNAL");
    assert.equal(/precio|breakdown|READY_FOR|pricing|draft/i.test(result.message), false);
    assert.equal(/\?/.test(result.message), false);
  });

  it("reconoce corrección de duración", () => {
    const result = renderDaniResponse(
      baseCtx({
        userMessage: "Perdón, al final son seis horas.",
        correctedFields: ["DURATION_HOURS"],
        fieldsLearnedThisTurn: ["DURATION_HOURS"],
        draft: {
          serviceType: "WEDDING",
          city: "Rosario",
          durationHours: 6,
        },
        missingFields: ["EVENT_DATE"],
      }),
    );
    assert.equal(result.responseType, "CORRECTION_ACKNOWLEDGEMENT");
    assert.match(result.message, /6 horas|seis horas/i);
    assert.equal((result.message.match(/\?/g) ?? []).length, 1);
  });

  it("variantes deterministas estables", () => {
    const a = pickDeterministicCopy(
      questionCopiesForField("EVENT_DATE"),
      "seed-a:EVENT_DATE:1",
      [],
    );
    const b = pickDeterministicCopy(
      questionCopiesForField("EVENT_DATE"),
      "seed-a:EVENT_DATE:1",
      [],
    );
    assert.equal(a.id, b.id);
    assert.notEqual(stableHash("x"), stableHash("y"));
  });

  it("intención visual sin buscar fotos", () => {
    const result = renderDaniResponse(
      baseCtx({
        userMessage: "Mostrame fotos de casamientos",
        detectedIntent: "GENERAL_SERVICE_INQUIRY",
        quoteStatus: undefined,
        missingFields: [],
        visualReferenceIntent: { requested: true, niche: "bodas" },
      }),
    );
    assert.equal(result.responseType, "VISUAL_REFERENCE_EMPTY");
    assert.match(result.message, /referencias autorizadas/i);
    assert.equal(/http|api|buscaré fotos/i.test(result.message), false);
  });

  it("intención no relacionada no fuerza presupuesto", () => {
    const result = renderDaniResponse(
      baseCtx({
        userMessage: "Quiero publicar un álbum.",
        detectedIntent: "UNKNOWN",
        quoteStatus: undefined,
        missingFields: [],
      }),
    );
    assert.equal(result.responseType, "INTENT_GUIDANCE");
    assert.equal(/fecha|horas de cobertura/i.test(result.message), false);
  });

  it("protecciones críticas de estilo", () => {
    assert.equal(hasCriticalStyleViolation("Indique la fecha"), true);
    assert.equal(hasCriticalStyleViolation("¿Cuándo sería?"), false);
  });

  it("fallback a legacy ante violación crítica simulada", () => {
    const legacy = renderLegacyResponse({
      intent: "QUOTE_REQUEST",
      missingFields: ["EVENT_DATE"],
      quoteStatus: "COLLECTING_INFORMATION",
    });
    assert.match(legacy, /fecha/i);

    const composed = composeConversationReply({
      userMessage: "ok",
      intent: "QUOTE_REQUEST",
      conversationStatus: "ACTIVE",
      conversationId: "c1",
      missingFields: ["EVENT_DATE"],
      fieldsLearnedThisTurn: [],
      quoteStatus: "COLLECTING_INFORMATION",
      styleEngine: "legacy",
    });
    assert.equal(composed.styleEngineUsed, "legacy");
    assert.equal(composed.text, legacy);
  });
});
