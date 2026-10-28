import { describe, expect, it } from "vitest";
import {
  effectiveCoverageSharePercent,
  isSeparateLocalActive,
  normalizeStudioStructure,
} from "./normalize";
import {
  createStudioOwner,
  createStudioPerson,
  defaultFixedCostScope,
  fixedCostScope,
  INITIAL_STUDIO_STRUCTURE,
  personScope,
  type CuantoCobroStudioStructure,
} from "./types";

describe("Mi estudio: modo local y coberturas (tipos y normalización)", () => {
  it("conserva separateLocal, los cinco campos de texto y los scope válidos", () => {
    const largo = "1".repeat(30);
    const n = normalizeStudioStructure({
      enabled: true,
      separateLocal: true,
      coverageSharePercent: largo,
      ownerLocalTimePercent: "20",
      ownerLocalSalaryMonthly: "500000",
      localGoodsCostPercent: "40",
      localMonthlyContributionManual: "100000",
      fixedCostGroups: [
        { id: "g", title: "G", items: [{ id: "a", label: "A", amount: "1", scope: "coverage" }, { id: "b", label: "B", amount: "1", scope: "otro" }] },
      ],
      people: [
        { id: "owner", role: "owner", scope: "local" },
        { id: "p1", role: "staff", scope: "coverage" },
        { id: "p2", role: "staff", scope: "shared" },
      ],
    })!;
    expect(n.separateLocal).toBe(true);
    expect(n.coverageSharePercent).toBe(largo.slice(0, 20));
    expect(n.ownerLocalTimePercent).toBe("20");
    expect(n.ownerLocalSalaryMonthly).toBe("500000");
    expect(n.localGoodsCostPercent).toBe("40");
    expect(n.localMonthlyContributionManual).toBe("100000");
    const items = n.fixedCostGroups[0].items;
    expect(items[0].scope).toBe("coverage");
    expect("scope" in items[1]).toBe(false);
    const p = Object.fromEntries(n.people.map((x) => [x.id, x]));
    expect(p.p1.scope).toBe("coverage");
    expect("scope" in p.p2).toBe(false);
  });

  it("sin los campos nuevos no agrega ninguno", () => {
    const n = normalizeStudioStructure({ enabled: true })!;
    for (const k of ["separateLocal", "coverageSharePercent", "ownerLocalTimePercent", "ownerLocalSalaryMonthly", "localGoodsCostPercent", "localMonthlyContributionManual"]) {
      expect(k in n).toBe(false);
    }
    expect(n.people.every((x) => !("scope" in x))).toBe(true);
    expect(n).toEqual(normalizeStudioStructure(n));
  });

  it("scope por omisión de los rubros", () => {
    expect(defaultFixedCostScope("premises")).toBe("local");
    expect(defaultFixedCostScope("utilities")).toBe("local");
    expect(defaultFixedCostScope("software")).toBe("shared");
    expect(defaultFixedCostScope("marketing")).toBe("shared");
    expect(defaultFixedCostScope("admin")).toBe("shared");
    expect(defaultFixedCostScope("desconocido")).toBe("local");
    expect(fixedCostScope("software", { id: "x", label: "", amount: "", isCustom: false })).toBe("shared");
    expect(fixedCostScope("software", { id: "x", label: "", amount: "", isCustom: false, scope: "coverage" })).toBe("coverage");
  });

  it("personScope: el dueño siempre es de coberturas", () => {
    expect(personScope(createStudioOwner({ scope: "local" }))).toBe("coverage");
    expect(personScope(createStudioPerson())).toBe("local");
    expect(personScope(createStudioPerson({ scope: "coverage" }))).toBe("coverage");
  });

  it("effectiveCoverageSharePercent", () => {
    expect(effectiveCoverageSharePercent({ ownerLocalTimePercent: "20" } as CuantoCobroStudioStructure)).toBe(80);
    expect(effectiveCoverageSharePercent({ coverageSharePercent: "70", ownerLocalTimePercent: "20" } as CuantoCobroStudioStructure)).toBe(70);
    expect(effectiveCoverageSharePercent({} as CuantoCobroStudioStructure)).toBe(100);
  });

  it("isSeparateLocalActive exige modo estudio y separateLocal", () => {
    const base = { ...INITIAL_STUDIO_STRUCTURE, enabled: true };
    expect(isSeparateLocalActive({ studioStructure: { ...base, separateLocal: true } })).toBe(true);
    expect(isSeparateLocalActive({ studioStructure: base })).toBe(false);
    expect(isSeparateLocalActive({ studioStructure: { ...base, enabled: false, separateLocal: true } })).toBe(false);
    expect(isSeparateLocalActive({ studioStructure: undefined })).toBe(false);
  });
});
