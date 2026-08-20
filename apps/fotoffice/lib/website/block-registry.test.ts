import { describe, expect, it } from "vitest";
import { WEBSITE_BLOCK_TYPES } from "./blocks";
import { WEBSITE_BLOCK_REGISTRY } from "./block-registry";

describe("WEBSITE_BLOCK_REGISTRY", () => {
  it("tiene View e Inspector para cada tipo declarado en WEBSITE_BLOCK_TYPES — agregar un tipo nuevo sin su entrada acá rompe este test antes que producción", () => {
    for (const type of WEBSITE_BLOCK_TYPES) {
      const entry = WEBSITE_BLOCK_REGISTRY[type];
      expect(entry, `falta entrada de registro para ${type}`).toBeDefined();
      expect(typeof entry.View).toBe("function");
      expect(typeof entry.Inspector).toBe("function");
    }
  });
});
