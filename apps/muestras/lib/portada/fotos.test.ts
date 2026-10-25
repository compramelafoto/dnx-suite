import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FOTOS_PORTADA } from "./fotos";

describe("FOTOS_PORTADA", () => {
  it("cada foto existe en public/ y tiene texto alternativo y autor", () => {
    for (const f of FOTOS_PORTADA) {
      expect(existsSync(path.join(__dirname, "../../public", f.src)), f.src).toBe(true);
      expect(f.alt.length).toBeGreaterThan(10);
      expect(f.autor).not.toBe("");
    }
  });
  it("no repite archivos", () => {
    expect(new Set(FOTOS_PORTADA.map((f) => f.src)).size).toBe(FOTOS_PORTADA.length);
  });
});
