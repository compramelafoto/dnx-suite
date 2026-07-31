/**
 * First-N + deadline benefit.
 * Ejecutar: pnpm --filter clickaton selfcheck:first-n-benefit
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ARGENTINA_2026_SHIRT_BENEFIT_DEADLINE,
  filterPhaseItemsByFirstNQuota,
  isBenefitDeadlineOpen,
  isConfirmedBenefitEligible,
  isFirstNBenefitAvailable,
} from "../lib/catalog/domain/first-n-benefit";
import { selectBenefitItemsToRevoke } from "../lib/catalog/domain/reconcile-first-n-on-confirm";
import { validateAllocationDrafts } from "../lib/admin/edition-finance/domain/validate-allocations";
import { EditionFinanceError } from "../lib/admin/edition-finance/domain/errors";
import {
  canMutateEditionFinancialDistribution,
} from "../lib/admin/edition-finance/permissions";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`first-n-benefit.selfcheck: ${msg}`);
}

function main() {
  // 1) first 100 / N+1
  assert(isFirstNBenefitAvailable({ stockLimit: 100, confirmedClaims: 99 }), "99/100 ok");
  assert(
    isFirstNBenefitAvailable({ stockLimit: 100, confirmedClaims: 100 }) === false,
    "100/100 blocked",
  );
  assert(
    isFirstNBenefitAvailable({
      stockLimit: 100,
      confirmedClaims: 99,
      heldClaims: 1,
    }) === false,
    "soft hold blocks oversell",
  );

  // 2) deadline
  const deadline = ARGENTINA_2026_SHIRT_BENEFIT_DEADLINE;
  assert(
    isBenefitDeadlineOpen({
      now: new Date("2026-08-30T23:59:59.000-03:00"),
      benefitDeadlineAt: deadline,
    }),
    "30/08 before close ok",
  );
  assert(
    isBenefitDeadlineOpen({
      now: new Date("2026-08-31T00:00:00.000-03:00"),
      benefitDeadlineAt: deadline,
    }) === false,
    "31/08 blocked",
  );
  assert(
    isConfirmedBenefitEligible({
      stockLimit: 100,
      confirmedBeneficiariesBeforeThis: 50,
      confirmedAt: new Date("2026-08-30T23:59:59.999-03:00"),
      benefitDeadlineAt: deadline,
    }),
    "confirm at deadline edge ok",
  );
  assert(
    isConfirmedBenefitEligible({
      stockLimit: 100,
      confirmedBeneficiariesBeforeThis: 50,
      confirmedAt: new Date("2026-08-31T00:00:00.000-03:00"),
      benefitDeadlineAt: deadline,
    }) === false,
    "confirm after deadline blocked",
  );

  // 3) filter by product + deadline
  const items = [
    {
      id: "a",
      productId: "shirt",
      stockLimit: 100,
      benefitDeadlineAt: deadline,
      quantity: 1,
    },
    { id: "b", productId: "other", stockLimit: null, quantity: 1 },
  ];
  const { available, omitted } = filterPhaseItemsByFirstNQuota(items, {
    confirmedByProductId: new Map([["shirt", 100]]),
    heldByProductId: new Map(),
    now: new Date("2026-08-15T12:00:00-03:00"),
  });
  assert(available.length === 1 && available[0]!.id === "b", "exhausted shirt omitted");
  assert(omitted.length === 1 && omitted[0]!.id === "a", "shirt omitted");

  // 4) race final slot — two candidates, only first gets benefit
  const meta = new Map([
    [
      "ppi1",
      {
        id: "ppi1",
        productId: "shirt",
        stockLimit: 100,
        benefitDeadlineAt: deadline,
      },
    ],
  ]);
  const race = selectBenefitItemsToRevoke({
    items: [
      { id: "i1", pricePhaseItemId: "ppi1", productId: "shirt" },
      { id: "i2", pricePhaseItemId: "ppi1", productId: "shirt" },
    ],
    phaseMetaById: meta,
    confirmedByProductId: new Map([["shirt", 99]]),
    confirmedAt: new Date("2026-08-20T12:00:00-03:00"),
  });
  assert(race.revokeItemIds.length === 1 && race.revokeItemIds[0] === "i2", "race: second revoked");

  // 5) allocation validations
  validateAllocationDrafts([
    { financialIdentityId: "fi1", sharePercent: 100, paymentConnectionId: "pa1" },
  ]);
  try {
    validateAllocationDrafts([
      { financialIdentityId: "fi1", sharePercent: 80 },
    ]);
    assert(false, "80% should reject");
  } catch (e) {
    assert(e instanceof EditionFinanceError, "80% EditionFinanceError");
  }
  try {
    validateAllocationDrafts([
      { financialIdentityId: "fi1", sharePercent: 120 },
    ]);
    assert(false, "120% should reject");
  } catch (e) {
    assert(e instanceof EditionFinanceError, "120% EditionFinanceError");
  }
  try {
    validateAllocationDrafts([
      { financialIdentityId: "fi1", sharePercent: 50 },
      { financialIdentityId: "fi1", sharePercent: 50 },
    ]);
    assert(false, "duplicate should reject");
  } catch (e) {
    assert(e instanceof EditionFinanceError, "dup EditionFinanceError");
  }

  // 6) viewer forbidden mutate
  assert(
    canMutateEditionFinancialDistribution({
      userId: 1,
      grants: [
        {
          id: "g1",
          userId: 1,
          capability: "PRODUCT_FINANCE_VIEWER",
          productKey: "clickaton",
          status: "ACTIVE",
        },
      ],
    }) === false,
    "viewer cannot mutate",
  );
  assert(
    canMutateEditionFinancialDistribution({
      userId: 5,
      grants: [
        {
          id: "g2",
          userId: 5,
          capability: "DNX_FINANCE_OWNER",
          productKey: null,
          status: "ACTIVE",
        },
      ],
    }) === true,
    "owner can mutate",
  );

  const root = process.cwd();
  const svc = readFileSync(
    join(root, "lib/public-registration/application/public-registration-service.ts"),
    "utf8",
  );
  assert(svc.includes("filterPhaseItemsByFirstNQuota"), "service filters first-N");
  assert(svc.includes("shirtBenefitEnded"), "context exposes ended state");

  const prismaRepo = readFileSync(
    join(root, "lib/public-registration/infrastructure/prisma-public-registration-repository.ts"),
    "utf8",
  );
  assert(prismaRepo.includes("benefitDeadlineAt"), "prisma maps deadline");
  assert(prismaRepo.includes("confirmedByProductId"), "prisma counts by product");

  const confirm = readFileSync(
    join(root, "lib/checkout/infrastructure/prisma-checkout-mutations.ts"),
    "utf8",
  );
  assert(confirm.includes("selectBenefitItemsToRevoke"), "confirm reconciles first-N");
  assert(confirm.includes("FOR UPDATE"), "confirm locks phase items");

  const seedCfg = readFileSync(join(root, "config/editions/argentina-2026.ts"), "utf8");
  assert(seedCfg.includes("firstNBenefitLimit: 100"), "AR2026 firstN=100");
  assert(seedCfg.includes("benefitDeadlineIso"), "AR2026 deadline config");
  assert(seedCfg.includes("30_000"), "shirt also on $30k phase seed");

  const media = readFileSync(
    join(root, "lib/admin/catalog/product-media-actions.ts"),
    "utf8",
  );
  assert(media.includes('namespace: "products"'), "media upload uses products namespace");
  assert(media.includes("SIZE_CHART"), "size chart upload");
  assert(media.includes("uploadProductGalleryImageAction"), "gallery upload");
  assert(media.includes("deleteProductMediaAction"), "media delete");
  assert(media.includes("reorderProductMediaAction"), "media reorder");
  assert(media.includes('deleteMany'), "media replacement clears previous");

  const financeUi = readFileSync(
    join(root, "components/admin/EditionDistributionEditor.tsx"),
    "utf8",
  );
  assert(financeUi.includes("Agregar recipient"), "generic allocation editor");
  assert(!financeUi.includes("Tammy"), "editor not Tammy-hardcoded");
  assert(financeUi.includes("paymentConnectionId"), "requires payment account");

  const prismaFinance = readFileSync(
    join(root, "lib/admin/edition-finance/infrastructure/prisma-edition-finance.ts"),
    "utf8",
  );
  assert(
    prismaFinance.includes("cuenta de cobro debe estar ACTIVE"),
    "inactive recipient rejected",
  );
  assert(
    prismaFinance.includes("Identidad financiera inexistente o inactiva"),
    "inactive identity rejected",
  );

  const included = readFileSync(
    join(root, "components/public-registration/IncludedProductsSection.tsx"),
    "utf8",
  );
  assert(included.includes("Ver guía de talles"), "frontend size guide CTA");
  assert(included.includes("ARGENTINA_2026_SHIRT_BENEFIT_COPY"), "benefit copy wired");
  assert(included.includes("ARGENTINA_2026_SHIRT_ENDED_COPY"), "ended copy wired");

  console.log("first-n-benefit.selfcheck: ok");
}

main();
