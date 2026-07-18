import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConversationTranscript } from "../conversation-transcript/conversation-transcript.js";
import type { QuoteRequiredField } from "../../quote-request/models.js";
import { evaluateDaniStyle } from "./evaluate-dani-style.js";
import { DaniStyleRuleCode } from "./dani-style-rules.js";
import { DANI_STYLE_VERSION } from "./dani-style-profile.js";

function transcript(
  assistantMessages: string[],
  extracted: QuoteRequiredField[][] = [],
): ConversationTranscript {
  return {
    scenarioId: "unit",
    turns: assistantMessages.map((assistantMessage, i) => ({
      turnNumber: i + 1,
      userMessage: `u${i + 1}`,
      assistantMessage,
      extractedFields: extracted[i] ?? [],
      missingFields: [],
      conversationStatus: "ACTIVE",
      warnings: [],
    })),
    final: {
      conversationStatus: "ACTIVE",
      missingFields: [],
    },
  };
}

describe("evaluateDaniStyle", () => {
  it("versión dani-style-v1 y score perfecto sin flags", () => {
    const result = evaluateDaniStyle(
      transcript(["¿Cuándo sería?"]),
      [new Set()],
    );
    assert.equal(result.version, DANI_STYLE_VERSION);
    assert.equal(result.score, 100);
    assert.equal(result.flags.length, 0);
  });

  it("detecta lenguaje de formulario", () => {
    const result = evaluateDaniStyle(
      transcript(["Indique la fecha del evento."]),
      [new Set()],
    );
    assert.ok(
      result.flags.some((f) => f.code === DaniStyleRuleCode.DANI_STYLE_FORM_LANGUAGE),
    );
    assert.ok(result.score <= 85);
  });

  it("detecta lenguaje técnico", () => {
    const result = evaluateDaniStyle(
      transcript(["Falta completar el draft del quoteRequest."]),
      [new Set()],
    );
    assert.ok(
      result.flags.some(
        (f) => f.code === DaniStyleRuleCode.DANI_STYLE_TECHNICAL_LANGUAGE,
      ),
    );
  });

  it("detecta múltiples preguntas", () => {
    const result = evaluateDaniStyle(
      transcript(["¿Cuándo sería? ¿Dónde lo vas a hacer?"]),
      [new Set()],
    );
    assert.ok(
      result.flags.some(
        (f) => f.code === DaniStyleRuleCode.DANI_STYLE_MULTIPLE_QUESTIONS,
      ),
    );
  });

  it("detecta frase genérica de chatbot", () => {
    const result = evaluateDaniStyle(
      transcript(["Estoy aquí para ayudarte con lo que necesites."]),
      [new Set()],
    );
    assert.ok(
      result.flags.some((f) => f.code === DaniStyleRuleCode.DANI_STYLE_CHATBOT_PHRASE),
    );
  });

  it("detecta pregunta repetida", () => {
    const q = "¿Para qué fecha necesitás el servicio?";
    const result = evaluateDaniStyle(transcript([q, q]), [new Set(), new Set()]);
    assert.ok(
      result.flags.some((f) => f.code === DaniStyleRuleCode.DANI_STYLE_REPEATED_QUESTION),
    );
  });

  it("detecta pregunta sobre campo ya conocido", () => {
    const result = evaluateDaniStyle(
      transcript(["¿En qué ciudad o localidad se realizará?"], [["CITY"]]),
      [new Set<QuoteRequiredField>(["CITY"])],
    );
    assert.ok(
      result.flags.some(
        (f) => f.code === DaniStyleRuleCode.DANI_STYLE_ALREADY_KNOWN_FIELD,
      ),
    );
  });
});
