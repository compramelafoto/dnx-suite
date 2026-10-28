import { describe, expect, it } from "vitest";
import { perfilDanielSeparado } from "../__fixtures__/studio-fixtures";
import type { CuantoCobroProfileInput } from "../types";
import { computeStudioBreakdown } from "./capacity";
import { computeStudioLocalAccount } from "./local-account";

function perfil(over: Record<string, unknown> = {}): CuantoCobroProfileInput {
  const p = perfilDanielSeparado();
  return { ...p, studioStructure: { ...p.studioStructure!, localGoodsCostPercent: "40", ...over } } as CuantoCobroProfileInput;
}

describe("Mi estudio: cuenta del local", () => {
  it("suma los gastos del local", () => {
    const c = computeStudioLocalAccount(perfil(), null)!;
    expect(c.costs).toEqual({ fixed: 835000, shared: 26000, team: 1950000, ownerSalary: 1000000, total: 3811000 });
  });
  it("con 2 meses de ventas queda «medido»", () => {
    const c = computeStudioLocalAccount(
      perfil(),
      { months: [{ month: "2026-12", sales: 5000000 }, { month: "2026-11", sales: 4000000 }] },
    )!;
    expect(c.status).toBe("medido");
    expect(c.averageLeaves).toBe(2700000);
    expect(c.averageResult).toBe(-1111000);
    expect(c.months[0]).toEqual({ month: "2026-12", sales: 5000000, leaves: 3000000, result: -811000 });
  });
  it("un solo mes con monto a mano queda «estimado»", () => {
    const c = computeStudioLocalAccount(perfil({ localMonthlyContributionManual: "3000000" }), {
      months: [{ month: "2026-12", sales: 5000000 }],
    })!;
    expect(c.status).toBe("estimado");
    expect(c.averageLeaves).toBe(3000000);
    expect(c.months).toHaveLength(1);
  });
  it("sin ventas ni monto a mano queda «sin-datos»", () => {
    const c = computeStudioLocalAccount(perfil({ localMonthlyContributionManual: "" }), null)!;
    expect(c.status).toBe("sin-datos");
    expect(c.averageLeaves).toBeNull();
    expect(c.averageResult).toBeNull();
  });
  it("promedia hasta 3 meses", () => {
    const c = computeStudioLocalAccount(perfil(), {
      months: [4, 4, 4, 100].map((m, i) => ({ month: `2026-0${9 - i}`, sales: m * 1000000 })),
    })!;
    expect(c.months).toHaveLength(3);
    expect(c.averageLeaves).toBe(2400000);
  });
  it("modo apagado: null", () => {
    const p = perfilDanielSeparado();
    const off = { ...p, studioStructure: { ...p.studioStructure!, separateLocal: false } } as CuantoCobroProfileInput;
    expect(computeStudioLocalAccount(off, null)).toBeNull();
  });
  it("no cambia la necesidad mensual de las coberturas", () => {
    const p = perfil();
    const antes = computeStudioBreakdown(p)!.monthlyNeed;
    computeStudioLocalAccount(p, { months: [{ month: "2026-12", sales: 9e6 }, { month: "2026-11", sales: 9e6 }] });
    expect(computeStudioBreakdown(p)!.monthlyNeed).toBe(antes);
  });
});
