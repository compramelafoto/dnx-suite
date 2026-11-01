import { describe, expect, it } from "vitest";
import { eligibleEntrantIds, normalizePhone, parseEntrantForm, parsePollOptions, voteTotals } from "./rules";

function form(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

describe("normalizePhone", () => {
  it("el mismo celular escrito de distintas formas da lo mismo", () => {
    expect(normalizePhone("+54 9 341 555-1234")).toBe("3415551234");
    expect(normalizePhone("341 5551234")).toBe("3415551234");
    expect(normalizePhone("0341 15 5551234")).not.toBe(""); // no explota con formatos raros
  });
});

describe("parseEntrantForm", () => {
  const base = { firstName: "Ana", lastName: "Pérez", phone: "3415551234", acceptRules: "on" };

  it("con celular único no pide DNI", () => {
    const r = parseEntrantForm(form(base), "CELULAR", true);
    expect(r.ok && r.values.dni).toBe(null);
  });

  it("con celular y DNI, el DNI es obligatorio", () => {
    expect(parseEntrantForm(form(base), "CELULAR_DNI", true).ok).toBe(false);
    const r = parseEntrantForm(form({ ...base, dni: "30.123.456" }), "CELULAR_DNI", true);
    expect(r.ok && r.values.dni).toBe("30123456");
  });

  it("exige aceptar las bases cuando hay bases", () => {
    const sinAceptar = { firstName: base.firstName, lastName: base.lastName, phone: base.phone };
    expect(parseEntrantForm(form(sinAceptar), "CELULAR", true).ok).toBe(false);
    expect(parseEntrantForm(form(sinAceptar), "CELULAR", false).ok).toBe(true);
  });
});

describe("eligibleEntrantIds", () => {
  const prizes = [
    { id: "p1", winnerEntrantId: "a", absentEntrantIds: [] },
    { id: "p2", winnerEntrantId: null, absentEntrantIds: ["b"] },
  ];

  it("saca a los que ya ganaron y a los ausentes de este premio", () => {
    expect(eligibleEntrantIds({ entrantIds: ["a", "b", "c"], prizeId: "p2", prizes, oneWinPerPerson: true })).toEqual(["c"]);
  });

  it("sin la regla, quien ganó puede volver a ganar", () => {
    expect(eligibleEntrantIds({ entrantIds: ["a", "b", "c"], prizeId: "p2", prizes, oneWinPerPerson: false })).toEqual(["a", "c"]);
  });
});

describe("encuestas", () => {
  it("una opción por renglón, sin vacías ni repetidas", () => {
    expect(parsePollOptions("Sí\n\n sí \nNo\n")).toEqual(["Sí", "No"]);
  });

  it("cuenta los votos por opción", () => {
    expect(voteTotals(3, [{ optionIndex: 0 }, { optionIndex: 2 }, { optionIndex: 2 }, { optionIndex: 9 }])).toEqual([1, 0, 2]);
  });
});
