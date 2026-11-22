import { describe, expect, it } from "vitest";
import { countSales, exclusionReason, selectEntrants, type CandidateUser } from "./elegibilidad";

const u = (id: number, extra: Partial<CandidateUser> = {}): CandidateUser => ({
  id,
  name: `Foto ${id}`,
  companyName: null,
  role: "PHOTOGRAPHER",
  isBlocked: false,
  tags: [],
  ...extra,
});

describe("quién entra", () => {
  it("cuenta las ventas por fotógrafo", () => {
    const m = countSales([{ userId: 1 }, { userId: 1 }, { userId: 2 }, { userId: null }]);
    expect(m.get(1)).toBe(2);
    expect(m.get(2)).toBe(1);
    expect(m.size).toBe(2);
  });

  it("entran los fotógrafos con ventas; quedan afuera admin, bloqueados, demos y excluidos", () => {
    const ventas = new Map([[1, 1], [2, 3], [3, 1], [4, 1], [5, 1], [6, 1]]);
    const users = [
      u(1),
      u(2, { role: "LAB_PHOTOGRAPHER" }),
      u(3, { role: "ADMIN" }),
      u(4, { isBlocked: true }),
      u(5, { tags: ["DEMO_PRESENTACION"] }),
      u(6),
    ];
    const r = selectEntrants({ sales: ventas, users, minSales: 1, excludedUserIds: [6] });
    expect(r.map((e) => e.userId).sort()).toEqual([1, 2]);
  });

  it("respeta el mínimo de ventas", () => {
    const ventas = new Map([[1, 1], [2, 3]]);
    const r = selectEntrants({ sales: ventas, users: [u(1), u(2)], minSales: 2, excludedUserIds: [] });
    expect(r.map((e) => e.userId)).toEqual([2]);
    expect(exclusionReason(u(1), 1, 2, new Set())).toBe("pocas-ventas");
  });

  it("sin ventas no entra aunque el mínimo sea 0", () => {
    expect(exclusionReason(u(1), 0, 0, new Set())).toBe("pocas-ventas");
  });
});
