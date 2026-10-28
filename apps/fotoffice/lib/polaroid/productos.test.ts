import { describe, expect, it } from "vitest";
import { cobroDePolaroids, escalon, skuPolaroid } from "./productos";
import { POLAROID_PRESETS } from "@/components/polaroid/presets";

describe("qué producto cobra cada polaroid", () => {
  it("cada medida del diseñador tiene su producto", () => {
    for (const p of POLAROID_PRESETS) expect(skuPolaroid(p.id, "INS", 1)).not.toBeNull();
  });

  it("la instantánea no tiene escalones", () => {
    expect(skuPolaroid("p75x10", "INS", 300)).toBe("POL-INS-75x10");
    expect(skuPolaroid("p9x13", "INS", 1)).toBe("POL-INS-9x13");
  });

  it("para mañana y la semana van por escalón, como las copias", () => {
    expect(escalon(3)).toBe(10);
    expect(escalon(50)).toBe(10);
    expect(escalon(51)).toBe(50);
    expect(escalon(101)).toBe(100);
    expect(skuPolaroid("p15x10", "MAN", 60)).toBe("POL-MAN-10x15-50");
    expect(skuPolaroid("p9x13", "SEM", 200)).toBe("POL-SEM-9x13-100");
  });

  it("junta las copias por medida y decide el escalón por el total", () => {
    const r = cobroDePolaroids(
      [
        { presetId: "p75x10", copies: 30 },
        { presetId: "p75x10", copies: 25 },
        { presetId: "p9x13", copies: 0 },
      ],
      "MAN",
    );
    expect(r).toEqual([
      { presetId: "p75x10", sku: "POL-MAN-75x10-50", cantidad: 55 },
      { presetId: "p9x13", sku: "POL-MAN-9x13-10", cantidad: 1 },
    ]);
  });
});
