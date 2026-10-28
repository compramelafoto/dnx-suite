/**
 * Cuenta del local de «Mi estudio» (spec 2026-10-28-cuanto-cobro-local-y-coberturas-design.md, §4.4–4.6). PURA.
 *
 *   gastosLocal = fijos del local + compartidos × (1 − % de coberturas) + costo de personas del local + sueldo del dueño en el local
 *   dejaLocal   = ventas × (1 − mercadería%)
 *   resultado   = dejaLocal − gastosLocal
 *
 * Sólo informa: nunca alimenta la necesidad mensual de las coberturas ni el precio de los eventos.
 */
import { parseCuantoCobroAmount } from "../amount-format";
import { parsePercent } from "../pricing-extras/price-build-up";
import type { CuantoCobroProfileInput } from "../types";
import { computeStudioPersonMonthlyCost } from "./capacity";
import { activeStudioStructure, effectiveCoverageSharePercent, isSeparateLocalActive } from "./normalize";
import { fixedCostScope, personScope } from "./types";

/** Ventas del local por mes completo (AAAA-MM), el más reciente primero. La app las arma desde Caja. */
export type StudioLocalSales = { months: { month: string; sales: number }[] };

export type StudioLocalAccount = {
  costs: { fixed: number; shared: number; team: number; ownerSalary: number; total: number };
  status: "sin-datos" | "estimado" | "medido";
  /** leaves = ventas × (1 − mercadería%). */
  months: { month: string; sales: number; leaves: number; result: number }[];
  averageLeaves: number | null;
  /** averageLeaves − costs.total. */
  averageResult: number | null;
};

const amount = (v: string | undefined): number => (v === undefined ? 0 : (parseCuantoCobroAmount(v) ?? 0));
const roundCents = (n: number): number => Math.round(n * 100) / 100;
const MAX_MONTHS = 3;
const MIN_MEASURED_MONTHS = 2;

export function computeStudioLocalAccount(
  profile: CuantoCobroProfileInput,
  sales: StudioLocalSales | null,
): StudioLocalAccount | null {
  if (!isSeparateLocalActive(profile)) return null;
  const structure = activeStudioStructure(profile);
  if (!structure) return null;

  let fixed = 0;
  let sharedTotal = 0;
  for (const g of structure.fixedCostGroups) {
    for (const i of g.items) {
      const scope = fixedCostScope(g.id, i);
      if (scope === "local") fixed += amount(i.amount);
      else if (scope === "shared") sharedTotal += amount(i.amount);
    }
  }
  const shared = (sharedTotal * (100 - effectiveCoverageSharePercent(structure))) / 100;
  // Se redondea a centavos: el costo por persona arrastra ruido de coma flotante (4,33 semanas, 13/12).
  const team = roundCents(
    structure.people.reduce(
      (t, p) => (p.role !== "owner" && personScope(p) === "local" ? t + computeStudioPersonMonthlyCost(p, 0) : t),
      0,
    ),
  );
  const ownerSalary = amount(structure.ownerLocalSalaryMonthly);
  const total = fixed + shared + team + ownerSalary;

  const goodsShare = Math.min(100, Math.max(0, parsePercent(structure.localGoodsCostPercent) ?? 0)) / 100;
  const months = (sales?.months ?? []).slice(0, MAX_MONTHS).map((m) => {
    const leaves = m.sales * (1 - goodsShare);
    return { month: m.month, sales: m.sales, leaves, result: leaves - total };
  });
  const costs = { fixed, shared, team, ownerSalary, total };

  if (months.length >= MIN_MEASURED_MONTHS) {
    const averageLeaves = months.reduce((t, m) => t + m.leaves, 0) / months.length;
    return { costs, status: "medido", months, averageLeaves, averageResult: averageLeaves - total };
  }
  const manualText = structure.localMonthlyContributionManual ?? "";
  if (manualText.trim() !== "" && parseCuantoCobroAmount(manualText) !== null) {
    const averageLeaves = amount(manualText);
    return { costs, status: "estimado", months, averageLeaves, averageResult: averageLeaves - total };
  }
  return { costs, status: "sin-datos", months, averageLeaves: null, averageResult: null };
}
