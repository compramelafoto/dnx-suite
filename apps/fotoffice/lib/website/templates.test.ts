import { describe, expect, it } from "vitest";
import { websiteBlockSchema } from "./blocks";
import { WEBSITE_TEMPLATES, getWebsiteTemplate } from "./templates";

describe("WEBSITE_TEMPLATES", () => {
  it("cada plantilla siembra bloques válidos según el schema vigente", () => {
    for (const template of WEBSITE_TEMPLATES) {
      const blocks = template.seedSections();
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(websiteBlockSchema.safeParse(block).success).toBe(true);
      }
    }
  });

  it("cada plantilla siembra ids únicos y order secuencial desde 0", () => {
    for (const template of WEBSITE_TEMPLATES) {
      const blocks = template.seedSections();
      const ids = new Set(blocks.map((b) => b.id));
      expect(ids.size).toBe(blocks.length);
      expect(blocks.map((b) => b.order)).toEqual(blocks.map((_, i) => i));
    }
  });

  it("getWebsiteTemplate devuelve undefined para un id inexistente, nunca inventa una plantilla", () => {
    expect(getWebsiteTemplate("no-existe")).toBeUndefined();
    expect(getWebsiteTemplate("minimal")?.id).toBe("minimal");
  });
});
