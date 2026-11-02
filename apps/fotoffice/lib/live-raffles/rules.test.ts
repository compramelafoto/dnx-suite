import { describe, expect, it } from "vitest";
import { currentWinners, eligibleEntrantIds, normalizePhone, parseEntrantForm, parsePollOptions, parseVote, voteTotals } from "./rules";

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
  const base = { firstName: "Ana", lastName: "Pérez", phone: "3415551234", email: "ana@mail.com", acceptRules: "on" };

  it("el correo es obligatorio", () => {
    const sinCorreo = { firstName: base.firstName, lastName: base.lastName, phone: base.phone, acceptRules: "on" };
    expect(parseEntrantForm(form(sinCorreo), "CELULAR", true).ok).toBe(false);
    expect(parseEntrantForm(form({ ...base, email: "no-es-correo" }), "CELULAR", true).ok).toBe(false);
  });

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
    const sinAceptar = { firstName: base.firstName, lastName: base.lastName, phone: base.phone, email: base.email };
    expect(parseEntrantForm(form(sinAceptar), "CELULAR", true).ok).toBe(false);
    expect(parseEntrantForm(form(sinAceptar), "CELULAR", false).ok).toBe(true);
  });
});

describe("eligibleEntrantIds", () => {
  const g = (round: number, entrantId: string, status = "GANADOR") => ({ round, entrantId, prizeId: null, status });
  const todos = ["a", "b", "c", "d", "e"];

  it("con máximo 1, quien ganó no vuelve a salir", () => {
    expect(eligibleEntrantIds({ entrantIds: todos, draws: [g(1, "a")], round: 2, maxWins: 1, cooldown: 0 })).toEqual(["b", "c", "d", "e"]);
  });

  it("con máximo 3, se puede ganar hasta tres veces", () => {
    const draws = [g(1, "a"), g(2, "a"), g(3, "a")];
    expect(eligibleEntrantIds({ entrantIds: ["a", "b"], draws: draws.slice(0, 2), round: 3, maxWins: 3, cooldown: 0 })).toEqual(["a", "b"]);
    expect(eligibleEntrantIds({ entrantIds: ["a", "b"], draws, round: 4, maxWins: 3, cooldown: 0 })).toEqual(["b"]);
  });

  it("con espera de 3, quien ganó en el 1 no sale en el 2, 3 ni 4, y sí en el 5", () => {
    const draws = [g(1, "a"), g(2, "b"), g(3, "c")];
    expect(eligibleEntrantIds({ entrantIds: todos, draws, round: 4, maxWins: 0, cooldown: 3 })).toEqual(["d", "e"]);
    const mas = [...draws, g(4, "d")];
    expect(eligibleEntrantIds({ entrantIds: todos, draws: mas, round: 5, maxWins: 0, cooldown: 3 })).toEqual(["a", "e"]);
  });

  it("al volver a sortear, el ausente de ese sorteo no sale y su resultado no cuenta", () => {
    const draws = [g(1, "a"), g(2, "b", "AUSENTE")];
    expect(eligibleEntrantIds({ entrantIds: ["a", "b", "c"], draws, round: 2, maxWins: 1, cooldown: 0 })).toEqual(["c"]);
  });
});

describe("currentWinners", () => {
  it("se queda con el último ganador de cada sorteo", () => {
    const draws = [
      { round: 1, entrantId: "a", prizeId: null, status: "AUSENTE" },
      { round: 1, entrantId: "b", prizeId: null, status: "GANADOR" },
      { round: 2, entrantId: "c", prizeId: null, status: "GANADOR" },
    ];
    expect(currentWinners(draws).map((d) => d.entrantId)).toEqual(["b", "c"]);
  });
});

describe("parseVote", () => {
  const opciones = { kind: "OPCIONES", options: ["Sí", "No"], allowOther: true };
  it("acepta una opción, 'Otra' con texto y párrafos", () => {
    expect(parseVote(form({ optionIndex: "1" }), opciones)).toEqual({ ok: true, optionIndex: 1, text: null });
    expect(parseVote(form({ optionIndex: "otra", text: "Tal vez" }), opciones)).toEqual({ ok: true, optionIndex: null, text: "Tal vez" });
    expect(parseVote(form({ optionIndex: "otra" }), opciones).ok).toBe(false);
    expect(parseVote(form({ text: "Me encantó" }), { kind: "TEXTO", options: [], allowOther: false })).toEqual({
      ok: true,
      optionIndex: null,
      text: "Me encantó",
    });
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
