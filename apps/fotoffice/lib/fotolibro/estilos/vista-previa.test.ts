import { describe, expect, it } from "vitest";
import { aislarIds } from "./vista-previa";

describe("aislarIds", () => {
  it("prefija los ids y sus referencias, sin tocar lo demás", () => {
    const svg = '<svg><defs><linearGradient id="g"/><filter id="a"/></defs><rect fill="url(#g)" filter="url(#a)"/><use href="#g"/><rect fill="url(#otro)"/></svg>';
    const r = aislarIds(svg, "x-");
    expect(r).toContain('id="x-g"');
    expect(r).toContain('fill="url(#x-g)"');
    expect(r).toContain('filter="url(#x-a)"');
    expect(r).toContain('href="#x-g"');
    expect(r).toContain("url(#otro)");
  });
});
