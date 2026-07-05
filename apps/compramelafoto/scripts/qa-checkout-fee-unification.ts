/**
 * QA Fase 1.5 — resolver unificado de fee % y cierre financiero.
 *
 * Uso (sin DB):
 *   npx tsx scripts/qa-checkout-fee-unification.ts
 *
 * Con regresión financiera DB (opcional):
 *   ALLOW_FINANCIAL_QA=1 npx tsx scripts/qa-checkout-fee-unification.ts --with-db
 */

import {
  resolveCheckoutFeePercentFromInjected,
  resolveLegacyCheckoutFeePercentFromInjected,
  resolveCheckoutFeePolicy,
  resolveLegacyProductionFeePolicy,
} from "@/lib/pricing/resolve-checkout-fee-percent";
import {
  CHECKOUT_FEE_FINANCIAL_BASE_ARS,
  closeCheckoutFinancials,
} from "@/lib/pricing/checkout-fee-financial-close";
import type { CheckoutFinancialScenario } from "@/lib/pricing/checkout-fee-financial-close";
import type { ResolveCheckoutFeePercentInput } from "@/lib/pricing/checkout-fee-types";

const FEE_PCT = 15;
const PRINT_FEE_PCT = 12;
const INJECTED = {
  r1DigitalPercent: FEE_PCT,
  r2PrintPercent: PRINT_FEE_PCT,
  r3LegacyPercent: 10,
};

type Row = {
  caseId: string;
  field: string;
  expected: string | number | boolean;
  actual: string | number | boolean;
  ok: boolean;
};

const rows: Row[] = [];

function assertRow(
  caseId: string,
  field: string,
  expected: string | number | boolean,
  actual: string | number | boolean
) {
  const ok =
    typeof expected === "number" && typeof actual === "number"
      ? expected === actual
      : String(expected) === String(actual);
  rows.push({ caseId, field, expected, actual, ok });
}

function albumInput(
  overrides: Partial<ResolveCheckoutFeePercentInput> = {}
): ResolveCheckoutFeePercentInput {
  return {
    component: "DIGITAL",
    flow: "ALBUM_ORDER",
    purpose: "CLIENT_LINE_UNIT",
    photographerId: 1,
    labId: null,
    hasPrintItems: false,
    ...overrides,
  };
}

function runPolicyCases() {
  const cases: Array<{ id: string; input: ResolveCheckoutFeePercentInput; expectResolver: string }> = [
    {
      id: "policy-digital-line",
      input: albumInput(),
      expectResolver: "R1",
    },
    {
      id: "policy-print-line",
      input: albumInput({ component: "PRINT" }),
      expectResolver: "R2",
    },
    {
      id: "policy-mixed-mp",
      input: albumInput({
        purpose: "ORGANIZER_BASE_EXTRACT",
        hasPrintItems: true,
      }),
      expectResolver: "R1",
    },
    {
      id: "policy-preventa",
      input: albumInput({ flow: "PREVENTA_PACK", purpose: "MARKETPLACE_FEE_TOTAL" }),
      expectResolver: "R1",
    },
    {
      id: "policy-pack",
      input: albumInput({ flow: "ALBUM_PACK", purpose: "MARKETPLACE_FEE_TOTAL" }),
      expectResolver: "R1",
    },
  ];

  for (const c of cases) {
    const route = resolveCheckoutFeePolicy(c.input);
    const resolved = resolveCheckoutFeePercentFromInjected(c.input, INJECTED);
    assertRow(c.id, "legacyResolver", c.expectResolver, route.legacyResolver);
    assertRow(c.id, "percent", resolved.percent, resolved.percent);
  }

  const d1Canonical = resolveCheckoutFeePercentFromInjected(albumInput(), INJECTED);
  const d1LegacyRoute = resolveLegacyProductionFeePolicy(albumInput());
  const d1Legacy = resolveLegacyCheckoutFeePercentFromInjected(albumInput(), INJECTED);
  assertRow("divergence-D1", "canonical R1", FEE_PCT, d1Canonical.percent);
  assertRow("divergence-D1", "legacy route R2", "R2", d1LegacyRoute.legacyResolver);
  assertRow("divergence-D1", "legacy percent R2", PRINT_FEE_PCT, d1Legacy.percent);

  const d2Route = resolveCheckoutFeePolicy(
    albumInput({ purpose: "ORGANIZER_BASE_EXTRACT", hasPrintItems: true })
  );
  const d2Legacy = resolveLegacyProductionFeePolicy(
    albumInput({ purpose: "ORGANIZER_BASE_EXTRACT", hasPrintItems: true })
  );
  assertRow("divergence-D2", "canonical R1", "R1", d2Route.legacyResolver);
  assertRow("divergence-D2", "legacy R3", "R3", d2Legacy.legacyResolver);
}

function runFinancialSuite() {
  const scenarios: CheckoutFinancialScenario[] = [
    "NORMAL",
    "REFERRAL",
    "EVENT_ORGANIZER",
    "EVENT_ORGANIZER_REFERRAL",
    "SCHOOL",
    "COLLABORATIVE",
    "MIXED",
    "PACK",
    "PREVENTA",
  ];

  for (const scenario of scenarios) {
    const r = closeCheckoutFinancials({
      scenario,
      marketplaceFeePercent: FEE_PCT,
      printLineFeePercent: PRINT_FEE_PCT,
      eventOrganizerPercent: 10,
      schoolOrganizerPercent: 10,
      referralBalanceArs: scenario.includes("REFERRAL") ? 500 : 0,
      mixedDigitalBaseArs: 5_000,
      mixedPrintBaseArs: 5_000,
    });

    assertRow(scenario, "cliente > base", true, r.clienteArs >= CHECKOUT_FEE_FINANCIAL_BASE_ARS);
    assertRow(scenario, "fee > 0", true, r.feeGrossArs > 0);
    assertRow(scenario, "closesExactly", true, r.closesExactly);
    assertRow(
      scenario,
      "balance MP",
      r.clienteArs,
      r.photographerMpArs + r.marketplaceFeeMpArs
    );

    if (scenario === "NORMAL") {
      assertRow(scenario, "cliente", 11_500, r.clienteArs);
      assertRow(scenario, "fee", 1_500, r.feeGrossArs);
      assertRow(scenario, "clf", 1_500, r.clfNetArs);
    }
    if (scenario === "REFERRAL") {
      assertRow(scenario, "referido", 500, r.referralEarningArs);
      assertRow(scenario, "clf", 500, r.clfNetArs);
    }
    if (scenario === "EVENT_ORGANIZER") {
      assertRow(scenario, "organizador", 1_000, r.organizerEventArs);
    }
    if (scenario === "SCHOOL" || scenario === "PREVENTA") {
      assertRow(scenario, "organizador escolar", 1_000, r.organizerSchoolArs);
    }
  }
}

function printTable() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(" QA Fase 1.5 — Checkout fee unification");
  console.log("══════════════════════════════════════════════════════════════");
  const cases = [...new Set(rows.map((r) => r.caseId))];
  for (const id of cases) {
    const group = rows.filter((r) => r.caseId === id);
    console.log(`\n[${id}]`);
    for (const r of group) {
      console.log(
        `  ${r.ok ? "✓" : "✗"} ${r.field}: expected ${r.expected}, got ${r.actual}`
      );
    }
  }
  const failed = rows.filter((r) => !r.ok).length;
  const passed = rows.filter((r) => r.ok).length;
  console.log(`\nTotal: ${passed} PASS, ${failed} FAIL de ${rows.length}`);
  return failed;
}

async function maybeRunDbRegression() {
  if (!process.argv.includes("--with-db")) return;
  if (process.env.ALLOW_FINANCIAL_QA !== "1" && process.env.ALLOW_FINANCIAL_QA !== "true") {
    console.warn("[qa-checkout-fee] --with-db omitido: set ALLOW_FINANCIAL_QA=1");
    return;
  }
  console.log("\n[qa-checkout-fee] Ejecutando scripts/qa-financial-regression.ts …");
  const { spawnSync } = await import("node:child_process");
  const child = spawnSync("npx", ["tsx", "scripts/qa-financial-regression.ts"], {
    stdio: "inherit",
    env: process.env,
  });
  if (child.status !== 0) {
    throw new Error("qa-financial-regression falló");
  }
}

async function main() {
  console.log("[qa-checkout-fee] Política + cierre financiero (sin DB)…");
  runPolicyCases();
  runFinancialSuite();
  const failed = printTable();
  await maybeRunDbRegression();
  if (failed > 0) process.exitCode = 1;
  else console.log("\n✓ QA Fase 1.5 PASS");
}

main().catch((err) => {
  console.error("[qa-checkout-fee] Error:", err);
  process.exit(1);
});
