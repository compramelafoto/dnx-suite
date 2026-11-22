import { describe, expect, it } from "vitest";
import { disciplinesPresent, hasDiscipline } from "./disciplines";

describe("hasDiscipline", () => {
  it("coincide con la principal o con alguna secundaria", () => {
    const a = { primaryDiscipline: "PINTURA", otherDisciplines: ["DIBUJO"] };
    expect(hasDiscipline(a, "PINTURA")).toBe(true);
    expect(hasDiscipline(a, "DIBUJO")).toBe(true);
    expect(hasDiscipline(a, "ESCULTURA")).toBe(false);
  });
});

describe("disciplinesPresent", () => {
  it("devuelve las disciplinas que aparecen, en el orden de DISCIPLINES, sin repetir ni inventar", () => {
    const items = [
      { primaryDiscipline: "ESCULTURA", otherDisciplines: ["CERAMICA", "NO_EXISTE"] },
      { primaryDiscipline: "PINTURA", otherDisciplines: ["ESCULTURA"] },
      { primaryDiscipline: "FOTOGRAFIA", otherDisciplines: [] },
    ];
    expect(disciplinesPresent(items)).toEqual(["FOTOGRAFIA", "PINTURA", "ESCULTURA", "CERAMICA"]);
  });
  it("lista vacía, sin disciplinas", () => expect(disciplinesPresent([])).toEqual([]));
});
