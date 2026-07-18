import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AssistantIntent } from "../models/assistant.js";
import { classifyIntent } from "./classify-intent.js";

function expectIntent(text: string, intent: AssistantIntent): void {
  assert.equal(classifyIntent(text).intent, intent, `text=${JSON.stringify(text)}`);
}

describe("classifyIntent", () => {
  it("clasifica saludos", () => {
    expectIntent("Hola", "GREETING");
    expectIntent("Buenos días", "GREETING");
    expectIntent("buenas!", "GREETING");
  });

  it("clasifica consulta general de servicios", () => {
    expectIntent("¿Qué servicios de fotografía ofrecen?", "GENERAL_SERVICE_INQUIRY");
    expectIntent("Hacen coberturas de boda?", "GENERAL_SERVICE_INQUIRY");
  });

  it("clasifica solicitud de presupuesto", () => {
    expectIntent("Hola, ¿cuánto sale un cumpleaños de 15?", "QUOTE_REQUEST");
    expectIntent("Necesito un presupuesto para una sesión", "QUOTE_REQUEST");
    expectIntent("Me pasás precio de cobertura?", "QUOTE_REQUEST");
    expectIntent("Che, me salió un casamiento.", "QUOTE_REQUEST");
    expectIntent(
      "Tengo un casamiento en Rosario el 20 de noviembre y son ocho horas.",
      "QUOTE_REQUEST",
    );
  });

  it("clasifica afirmativo y negativo", () => {
    expectIntent("sí", "AFFIRMATIVE");
    expectIntent("dale", "AFFIRMATIVE");
    expectIntent("no", "NEGATIVE");
    expectIntent("no, gracias", "NEGATIVE");
  });

  it("clasifica agradecimiento", () => {
    expectIntent("Muchas gracias", "THANKS");
    expectIntent("gracias!", "THANKS");
  });

  it("clasifica handoff humano", () => {
    expectIntent("Quiero hablar con una persona", "HUMAN_HANDOFF_REQUEST");
    expectIntent("Pasame con un asesor", "HUMAN_HANDOFF_REQUEST");
  });

  it("clasifica fuera de alcance", () => {
    expectIntent("Me ayudan con programación en Python?", "OUT_OF_SCOPE");
    expectIntent("Quiero tips de crypto", "OUT_OF_SCOPE");
  });

  it("devuelve UNKNOWN si no hay match", () => {
    expectIntent("asdf qwerty 123", "UNKNOWN");
  });
});
