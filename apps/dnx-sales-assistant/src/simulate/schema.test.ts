import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simulateMessageRequestSchema } from "./schema.js";

describe("simulateMessageRequestSchema", () => {
  it("acepta el contrato mínimo y normaliza from", () => {
    const parsed = simulateMessageRequestSchema.safeParse({
      from: "+54 9 341 123-4567",
      message: "Hola, ¿cuánto sale un cumpleaños de 15?",
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.from, "5493411234567");
    assert.equal(parsed.data.message, "Hola, ¿cuánto sale un cumpleaños de 15?");
  });

  it("rechaza claves adicionales", () => {
    const parsed = simulateMessageRequestSchema.safeParse({
      from: "5493411234567",
      message: "Hola",
      extra: true,
    });
    assert.equal(parsed.success, false);
  });

  it("rechaza from demasiado corto tras normalizar", () => {
    const parsed = simulateMessageRequestSchema.safeParse({
      from: "12345",
      message: "Hola",
    });
    assert.equal(parsed.success, false);
  });

  it("rechaza message vacío o solo espacios", () => {
    const parsed = simulateMessageRequestSchema.safeParse({
      from: "5493411234567",
      message: "   ",
    });
    assert.equal(parsed.success, false);
  });
});
