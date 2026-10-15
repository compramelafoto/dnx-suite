import { describe, expect, it } from "vitest";
import {
  emptyHangingPlan, formatCm, hangingLayout, hangingPlanProblems, parseHangingPlan, unassignedWorks, type HangingWall,
} from "./hanging";

const pared = (items: [number, number][], widthCm = 400, heightCm: number | null = null): HangingWall => ({
  id: "p1", name: "Norte", widthCm, heightCm,
  items: items.map(([w, h], i) => ({ workId: `w${i + 1}`, frameWidthCm: w, frameHeightCm: h })),
});

describe("parseHangingPlan", () => {
  it("lee un plano válido y descarta obras que ya no están o repetidas", () => {
    const { plan, droppedItems } = parseHangingPlan({
      version: 1, centerHeightCm: "145,5",
      walls: [
        { id: "a", name: "  Norte  ", widthCm: 640, heightCm: 300, items: [
          { workId: "w1", frameWidthCm: 40, frameHeightCm: "50" },
          { workId: "borrada", frameWidthCm: 40, frameHeightCm: 50 },
        ] },
        { id: "a", name: "Sur", widthCm: 300, items: [{ workId: "w1", frameWidthCm: 30, frameHeightCm: 40 }, { workId: "w2", frameWidthCm: 30, frameHeightCm: 40 }] },
      ],
    }, ["w1", "w2"]);
    expect(droppedItems).toBe(2);
    expect(plan.centerHeightCm).toBe(145.5);
    expect(plan.walls.map((w) => [w.id, w.name, w.widthCm, w.heightCm, w.items.map((i) => i.workId)])).toEqual([
      ["a", "Norte", 640, 300, ["w1"]],
      ["a-2", "Sur", 300, null, ["w2"]],
    ]);
  });
  it("cualquier cosa rara da un plano vacío", () => {
    expect(parseHangingPlan(null, []).plan).toEqual(emptyHangingPlan());
    expect(parseHangingPlan("x", []).plan).toEqual(emptyHangingPlan());
    expect(parseHangingPlan({ walls: [1, null, "x"] }, []).plan.walls).toEqual([]);
  });
  it("tope de 30 paredes", () => {
    const walls = Array.from({ length: 35 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, widthCm: 100, items: [] }));
    expect(parseHangingPlan({ walls }, []).plan.walls).toHaveLength(30);
  });
  it("las obras de las paredes de más se cuentan como descartadas", () => {
    const walls = Array.from({ length: 32 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, widthCm: 100, items: i >= 30 ? [{ workId: `w${i}` }, { workId: "x" }] : [] }));
    expect(parseHangingPlan({ walls }, ["w30", "w31"]).droppedItems).toBe(4);
  });
  it("los ids de pared repetidos nunca chocan", () => {
    const { plan } = parseHangingPlan({ walls: ["x-3", "x", "x", "x"].map((id) => ({ id, name: id, widthCm: 100, items: [] })) }, []);
    const ids = plan.walls.map((w) => w.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids[0]).toBe("x-3");
    expect(ids[1]).toBe("x");
  });
});

describe("hangingPlanProblems", () => {
  it("un plano correcto no tiene problemas", () => {
    expect(hangingPlanProblems({ version: 1, centerHeightCm: 150, walls: [pared([[40, 50]])] })).toEqual([]);
  });
  it("explica cada problema", () => {
    expect(hangingPlanProblems({
      version: 1, centerHeightCm: 90,
      walls: [{ ...pared([[0, 50]], 10, 100), name: "" }],
    })).toEqual([
      "La línea de centro tiene que estar entre 100 y 200 cm del piso.",
      "La pared 1 necesita un nombre.",
      "El ancho de \"Pared 1\" tiene que estar entre 30 y 5000 cm.",
      "El alto de \"Pared 1\" tiene que estar entre 150 y 1500 cm.",
      "Revisá la medida del marco n.º 1 de \"Pared 1\": entre 5 y 300 cm por lado.",
    ]);
  });
});

describe("hangingLayout", () => {
  it("espacio parejo entre obras y bordes, centro a 150 cm", () => {
    const l = hangingLayout(pared([[80, 100], [80, 100], [80, 100]]), 150);
    expect(l.fits).toBe(true);
    expect(l.gapCm).toBe(40);
    expect(l.positions.map((p) => [p.number, p.leftCm, p.centerFromLeftCm, p.bottomCm, p.topCm])).toEqual([
      [1, 40, 80, 100, 200], [2, 160, 200, 100, 200], [3, 280, 320, 100, 200],
    ]);
    expect(l.warnings).toEqual([]);
  });
  it("avisa si no entran", () => {
    const l = hangingLayout(pared([[150, 100], [150, 100], [150, 100]]), 150);
    expect(l.fits).toBe(false);
    expect(l.gapCm).toBe(0);
    expect(l.warnings).toEqual(["No entran: los marcos suman 450 cm y la pared mide 400 cm."]);
  });
  it("avisa si quedan muy juntas", () => {
    expect(hangingLayout(pared([[95, 50], [95, 50], [95, 50]], 300), 150).warnings).toEqual(["Quedan muy juntas: 3,8 cm entre obras."]);
  });
  it("avisa si llega al piso o pasa el alto de la pared", () => {
    expect(hangingLayout(pared([[50, 220]]), 100).warnings).toEqual(["La obra n.º 1 llega al piso: subí la línea de centro o achicá el marco."]);
    expect(hangingLayout(pared([[50, 220]], 400, 250), 150).warnings).toEqual(["La obra n.º 1 pasa el alto de la pared."]);
  });
  it("una pared vacía no tiene posiciones ni avisos", () => {
    expect(hangingLayout(pared([]), 150)).toEqual({ positions: [], gapCm: 400, framesCm: 0, fits: true, warnings: [] });
  });
});

describe("utilidades", () => {
  it("obras sin pared, en su orden", () => {
    const plan = { version: 1 as const, centerHeightCm: 150, walls: [pared([[40, 50]])] };
    expect(unassignedWorks(plan, [{ id: "w1" }, { id: "w2" }, { id: "w3" }]).map((w) => w.id)).toEqual(["w2", "w3"]);
  });
  it("centímetros con coma decimal", () => {
    expect(formatCm(150)).toBe("150");
    expect(formatCm(152.5)).toBe("152,5");
  });
});
