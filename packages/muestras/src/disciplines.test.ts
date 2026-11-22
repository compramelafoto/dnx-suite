import { describe, expect, it } from "vitest";
import { DISCIPLINES, DISCIPLINE_LABELS, DISCIPLINE_MEASURE_GROUP, PHOTOGRAPHY, isDiscipline, parseOtherDisciplines } from "./disciplines";

describe("disciplines", () => {
  it("tiene las 16 disciplinas, la fotografía primero", () => {
    expect(DISCIPLINES).toHaveLength(16);
    expect(DISCIPLINES[0]).toBe("FOTOGRAFIA");
    expect(PHOTOGRAPHY).toBe("FOTOGRAFIA");
  });
  it("cada disciplina tiene etiqueta y grupo de medidas", () => {
    for (const d of DISCIPLINES) {
      expect(DISCIPLINE_LABELS[d]).toBeTruthy();
      expect(DISCIPLINE_MEASURE_GROUP[d]).toBeTruthy();
    }
    expect(DISCIPLINE_LABELS.GRABADO).toBe("Grabado y obra gráfica");
    expect(DISCIPLINE_MEASURE_GROUP.ESCULTURA).toBe("volumen");
    expect(DISCIPLINE_MEASURE_GROUP.TEXTIL).toBe("plana");
    expect(DISCIPLINE_MEASURE_GROUP.VIDEOARTE).toBe("tiempo");
    expect(DISCIPLINE_MEASURE_GROUP.OTRA).toBe("libre");
  });
  it("isDiscipline distingue mayúsculas y valores raros", () => {
    expect(isDiscipline("PINTURA")).toBe(true);
    expect(isDiscipline("pintura")).toBe(false);
    expect(isDiscipline(3)).toBe(false);
  });
  it("parseOtherDisciplines deja únicas, válidas, sin la principal", () => {
    expect(parseOtherDisciplines(["PINTURA", "PINTURA", "FOTOGRAFIA", "X", "DIBUJO"], "FOTOGRAFIA")).toEqual(["PINTURA", "DIBUJO"]);
  });
  it("parseOtherDisciplines acepta como máximo 5", () => {
    const r = parseOtherDisciplines(["PINTURA", "DIBUJO", "GRABADO", "ILUSTRACION", "COLLAGE", "ESCULTURA", "CERAMICA"], "FOTOGRAFIA");
    expect(r).toHaveLength(5);
    expect(r[4]).toBe("COLLAGE");
  });
});
