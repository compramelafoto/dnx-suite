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
  type FakeItem = { make: string; model: string; ownerId: number; status: string; kind: string };
  type FakeSighting = { make: string; model: string; photographerId: number | null; kind: string };
  let items: FakeItem[];
  let sightings: FakeSighting[];
  const it3 = (make: string, model: string, ownerIds: number[], status = "IN_USE"): FakeItem[] =>
    ownerIds.map((ownerId) => ({ make, model, ownerId, status, kind: "LENS" }));

  beforeEach(() => {
    vi.clearAllMocks();
    items = [];
    sightings = [];
    m.itemFindMany.mockImplementation(async ({ where }) =>
      items.filter(
        (i) => !where.status?.notIn?.includes(i.status) && (!where.kind || i.kind === where.kind),
      ),
    );
    m.sightingFindMany.mockImplementation(async ({ where }) =>
      sightings.filter(
        (x) => x.photographerId !== null && (!where.kind || x.kind === where.kind),
      ),
    );
  });

  it("un modelo de 2 personas no sale", async () => {
    items = it3("Sony", "FE 20mm F1.8 G", [1, 2]);
    expect(await knownModels()).toEqual([]);
  });

  it("con 3 personas distintas sale, con la forma de escribir más común", async () => {
    items = [...it3("Sony", "FE 20mm F1.8 G", [1, 2]), ...it3("SONY", "Sony FE 20mm f/1.8 G", [3])];
    expect(await knownModels()).toEqual([{ make: "Sony", model: "FE 20mm F1.8 G" }]);
  });

  it("la misma persona 3 veces no alcanza", async () => {
    items = it3("Canon", "EOS R6", [1, 1, 1]);
    sightings = [{ make: "Canon", model: "EOS R6", photographerId: 1, kind: "BODY" }];
    expect(await knownModels()).toEqual([]);
  });

  it("los equipos robados o perdidos no cuentan", async () => {
    items = [...it3("Canon", "EOS R6", [1, 2]), ...it3("Canon", "EOS R6", [3], "STOLEN")];
    expect(await knownModels()).toEqual([]);
    expect(m.itemFindMany.mock.calls[0][0].where.status).toEqual({ notIn: ["STOLEN", "LOST"] });
  });

  it("suma dueños del inventario y fotógrafos de CLF", async () => {
    items = it3("Nikon", "Z 6", [1, 2]);
    sightings = [
      { make: "NIKON CORPORATION", model: "NIKON Z 6", photographerId: 9, kind: "BODY" },
      { make: "NIKON CORPORATION", model: "NIKON Z 6", photographerId: null, kind: "BODY" },
    ];
    expect(await knownModels()).toEqual([{ make: "Nikon", model: "Z 6" }]);
    expect(m.sightingFindMany.mock.calls[0][0]).toMatchObject({
      where: { photographerId: { not: null } },
      distinct: ["make", "model", "photographerId"],
    });
    expect(m.itemFindMany.mock.calls[0][0].distinct).toEqual(["make", "model", "ownerId"]);
  });

  it("nunca devuelve quién lo tiene", async () => {
    items = it3("Sony", "A7 III", [1, 2, 3]);
    const r = await knownModels();
    expect(Object.keys(r[0]).sort()).toEqual(["make", "model"]);
  });

  it("filtra por tipo; los avistajes sólo existen para cuerpos y lentes", async () => {
    await knownModels("LENS");
    expect(m.itemFindMany.mock.calls[0][0].where.kind).toBe("LENS");
    expect(m.sightingFindMany.mock.calls[0][0].where.kind).toBe("LENS");
    vi.clearAllMocks();
    m.itemFindMany.mockResolvedValue([]);
    await knownModels("TRIPOD");
    expect(m.sightingFindMany).not.toHaveBeenCalled();
  });

  it("como mucho 500", async () => {
    items = Array.from({ length: 501 }, (_, n) => it3("Sony", `M${n}`, [1, 2, 3])).flat();
    expect(await knownModels()).toHaveLength(500);
  });
});
