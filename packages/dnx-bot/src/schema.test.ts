import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toInputSchema } from "./schema";

describe("toInputSchema", () => {
  it("produce un objeto JSON Schema sin la clave $schema", () => {
    const s = toInputSchema(z.strictObject({ albumId: z.number().int().positive() }));
    expect(s.type).toBe("object");
    expect(s).not.toHaveProperty("$schema");
    expect((s.properties as Record<string, unknown>).albumId).toBeDefined();
  });
});
