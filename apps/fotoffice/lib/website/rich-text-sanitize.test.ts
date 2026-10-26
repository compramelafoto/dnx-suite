import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createEmptyBlock, type WebsiteBlock } from "./blocks";
import { sanitizeBlocksForSave, sanitizeRichTextConfig } from "./rich-text-sanitize";

describe("rich-text-sanitize", () => {
  it("sanitizeRichTextConfig saca el <script> y los atributos de evento, conserva el formato", () => {
    const config = {
      html: '<p onclick="x()">Hola <strong>mundo</strong></p><script>alert(1)</script><img src="x" onerror="y()">',
      align: "left" as const,
      width: "normal" as const,
    };
    const clean = sanitizeRichTextConfig(config);
    expect(clean.html).not.toContain("script");
    expect(clean.html).not.toContain("onclick");
    expect(clean.html).not.toContain("onerror");
    expect(clean.html).toContain("<strong>mundo</strong>");
  });

  it("un iframe fuera de la lista (YouTube/Vimeo) se descarta al sanear", () => {
    const clean = sanitizeRichTextConfig({ html: '<iframe src="https://evil.com/x"></iframe><p>ok</p>', align: "left", width: "normal" });
    expect(clean.html).not.toContain("iframe");
    expect(clean.html).toContain("<p>ok</p>");
  });

  it("sanitizeBlocksForSave limpia sólo los RICH_TEXT y no muta la entrada", () => {
    const rich = createEmptyBlock("RICH_TEXT", 0) as Extract<WebsiteBlock, { type: "RICH_TEXT" }>;
    rich.config.html = "<p>ok</p><script>x</script>";
    const text = createEmptyBlock("TEXT", 1);
    const out = sanitizeBlocksForSave([rich, text]);
    expect((out[0] as typeof rich).config.html).toBe("<p>ok</p>");
    expect(rich.config.html).toContain("script");
    expect(out[1]).toBe(text);
  });

  it("blocks.ts no carga @repo/content (llega al bundle del navegador)", () => {
    const src = readFileSync(new URL("./blocks.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from "@repo\/content"/);
  });
});
