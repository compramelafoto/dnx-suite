import { describe, expect, it } from "vitest";
import { groupBoardSeats } from "./public-board";

describe("groupBoardSeats", () => {
  it("junta a quienes comparten cargo y respeta el orden de llegada", () => {
    const seats = groupBoardSeats([
      { officeId: "p", officeName: "Presidente", displayName: "Ana" },
      { officeId: "v", officeName: "Vocal titular", displayName: "Beto" },
      { officeId: "v", officeName: "Vocal titular", displayName: "Carla" },
      { officeId: "r", officeName: "Revisor de cuentas", displayName: "Dani" },
    ]);
    expect(seats).toEqual([
      { officeName: "Presidente", names: ["Ana"] },
      { officeName: "Vocal titular", names: ["Beto", "Carla"] },
      { officeName: "Revisor de cuentas", names: ["Dani"] },
    ]);
  });

  it("sin integrantes no hay cargos", () => {
    expect(groupBoardSeats([])).toEqual([]);
  });
});
