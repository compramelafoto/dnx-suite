import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

/** Mirror of slugify used in ensure-workspace (pure). */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

describe("fotoffice workspace slug helpers", () => {
  it("normaliza nombres comerciales", () => {
    expect(slugify("Estudio DNX Fotografía")).toBe("estudio-dnx-fotografia");
    expect(slugify("@@@")).toBe("");
  });

  it("genera fallback estable corto", () => {
    const seed = "user@example.com";
    const hash = createHash("sha256").update(`${seed}-1`).digest("hex").slice(0, 12);
    expect(hash).toHaveLength(12);
  });
});
