import { describe, expect, it } from "vitest";
import { costMicroUsd } from "./cost";

describe("costMicroUsd", () => {
  it("Sonnet 5.5: 1M entrada + 1M salida = USD 12", () => {
    expect(costMicroUsd("claude-sonnet-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBe(12_000_000);
  });
  it("cobra lectura y escritura de caché aparte", () => {
    expect(
      costMicroUsd("claude-sonnet-5-5", {
        input_tokens: 0, output_tokens: 0,
        cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000,
      }),
    ).toBe(200_000 + 2_500_000);
  });
  it("modelo desconocido usa el precio más caro conocido (nunca subestima)", () => {
    expect(costMicroUsd("modelo-x", { input_tokens: 1_000_000, output_tokens: 0 })).toBe(4_000_000);
  });
});
