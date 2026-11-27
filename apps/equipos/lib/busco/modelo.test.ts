import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ itemFindMany: vi.fn(), sightingFindMany: vi.fn() }));

vi.mock("@repo/db", () => ({
  prisma: {
    gearItem: { findMany: m.itemFindMany },
    gearSerialSighting: { findMany: m.sightingFindMany },
  },
}));

import { knownModels, makeKey, makeVariants, modelKey } from "./modelo";

describe("modelKey", () => {
  it("el ejemplo del encargo: mayúsculas, barras, puntos y marca repetida dan lo mismo", () => {
    expect(modelKey("Sony", "FE 20mm F1.8 G")).toBe("sony:fe20mmf18g");
    expect(modelKey("SONY", "Sony FE 20mm f/1.8 G")).toBe("sony:fe20mmf18g");
  });

  it("une los alias de marca", () => {
    expect(modelKey("NIKON CORPORATION", "NIKON Z 6_2")).toBe(modelKey("Nikon", "Z 6_2"));
    expect(modelKey("Canon Inc.", "Canon EOS R6")).toBe("canon:eosr6");
    expect(modelKey("Sony Corporation", "ILCE-7M3")).toBe("sony:ilce7m3");
    expect(modelKey("FUJIFILM Corporation", "X-T4")).toBe("fujifilm:xt4");
    expect(modelKey("OLYMPUS IMAGING CORP.", "E-M5")).toBe("olympus:em5");
    expect(modelKey("OM Digital Solutions", "E-M1 Mark III")).toBe("olympus:em1markiii");
  });

  it("saca acentos, guiones y espacios de más", () => {
    expect(modelKey("  Sigma ", " 24-70mm  F2.8 DG DN Art ")).toBe("sigma:2470mmf28dgdnart");
    expect(modelKey("Lumix", "Óptica Ñ")).toBe("lumix:optican");
  });

  it("modelos distintos dan claves distintas", () => {
    expect(modelKey("Sony", "FE 20mm F1.8 G")).not.toBe(modelKey("Sony", "FE 24mm F1.4 GM"));
    expect(modelKey("Sony", "FE 20mm F1.8 G")).not.toBe(modelKey("Samyang", "FE 20mm F1.8 G"));
    expect(modelKey("Canon", "R6")).not.toBe(modelKey("Canon", "R6 Mark II"));
  });

  it("la marca sólo se saca si es una palabra entera al principio", () => {
    expect(modelKey("Canon", "Canonet QL17")).toBe("canon:canonetql17");
  });
});

describe("makeKey y makeVariants", () => {
  it("la marca normalizada y sus alias para buscar en la base", () => {
    expect(makeKey("Nikon Corporation")).toBe("nikon");
    expect(makeVariants("Olympus")).toEqual(
      expect.arrayContaining(["olympus", "olympus imaging corp.", "om digital solutions"]),
    );
    expect(makeVariants("Leica")).toEqual(["leica"]);
  });
});

describe("knownModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.itemFindMany.mockResolvedValue([
      { make: "Sony", model: "FE 20mm F1.8 G" },
      { make: "Canon", model: "EOS R6" },
    ]);
    m.sightingFindMany.mockResolvedValue([
      { make: "SONY", model: "Sony FE 20mm f/1.8 G" },
      { make: "NIKON CORPORATION", model: "NIKON Z 6" },
    ]);
  });

  it("junta inventarios y avistajes sin repetir el mismo modelo, ordenados", async () => {
    expect(await knownModels()).toEqual([
      { make: "Canon", model: "EOS R6" },
      { make: "NIKON CORPORATION", model: "NIKON Z 6" },
      { make: "Sony", model: "FE 20mm F1.8 G" },
    ]);
    expect(m.itemFindMany.mock.calls[0][0]).toMatchObject({
      distinct: ["make", "model"],
      select: { make: true, model: true },
      take: 500,
    });
    // Nunca se pide quién es el dueño.
    expect(JSON.stringify(m.itemFindMany.mock.calls[0][0])).not.toContain("owner");
    expect(JSON.stringify(m.sightingFindMany.mock.calls[0][0])).not.toContain("photographer");
  });

  it("filtra por tipo; los avistajes sólo existen para cuerpos y lentes", async () => {
    await knownModels("LENS");
    expect(m.itemFindMany.mock.calls[0][0].where).toEqual({ kind: "LENS" });
    expect(m.sightingFindMany.mock.calls[0][0].where).toEqual({ kind: "LENS" });
    vi.clearAllMocks();
    m.itemFindMany.mockResolvedValue([]);
    await knownModels("TRIPOD");
    expect(m.sightingFindMany).not.toHaveBeenCalled();
  });

  it("como mucho 500", async () => {
    m.itemFindMany.mockResolvedValue(
      Array.from({ length: 500 }, (_, i) => ({ make: "Sony", model: `M${i}` })),
    );
    m.sightingFindMany.mockResolvedValue([{ make: "Canon", model: "R" }]);
    expect(await knownModels()).toHaveLength(500);
  });
});
