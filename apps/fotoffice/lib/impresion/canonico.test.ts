import { describe, expect, it } from "vitest";
import { canonico } from "./canonico";

describe("canonico", () => {
  it("ordena las claves a cualquier profundidad y se salta las indefinidas", () => {
    expect(canonico({ b: 1, a: { d: [2, { z: 1, y: undefined }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"z":1}]},"b":1}');
    expect(canonico({ x: 1, y: 2 })).toBe(canonico({ y: 2, x: 1 }));
  });
});
