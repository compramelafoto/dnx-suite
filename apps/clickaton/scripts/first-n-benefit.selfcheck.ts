/**
 * First-N benefit ≠ capacity.
 * Ejecutar: pnpm --filter clickaton selfcheck:first-n-benefit
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  filterPhaseItemsByFirstNQuota,
  isFirstNBenefitAvailable,
} from "../lib/catalog/domain/first-n-benefit";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`first-n-benefit.selfcheck: ${msg}`);
}

function main() {
  assert(isFirstNBenefitAvailable({ stockLimit: null, claimed: 999 }), "null limit always ok");
  assert(isFirstNBenefitAvailable({ stockLimit: 100, claimed: 99 }), "99/100 ok");
  assert(isFirstNBenefitAvailable({ stockLimit: 100, claimed: 100 }) === false, "100/100 blocked");
  assert(isFirstNBenefitAvailable({ stockLimit: 100, claimed: 101 }) === false, "101 blocked");

  const items = [
    { id: "a", stockLimit: 2, quantity: 1 },
    { id: "b", stockLimit: null, quantity: 1 },
  ];
  const { available, omitted } = filterPhaseItemsByFirstNQuota(items, {
    byItemId: new Map([
      ["a", 2],
      ["b", 50],
    ]),
  });
  assert(available.length === 1 && available[0]!.id === "b", "b unlimited kept");
  assert(omitted.length === 1 && omitted[0]!.id === "a", "a exhausted omitted");

  const root = process.cwd();
  const svc = readFileSync(
    join(root, "lib/public-registration/application/public-registration-service.ts"),
    "utf8",
  );
  assert(svc.includes("filterPhaseItemsByFirstNQuota"), "service filters first-N");
  assert(svc.includes("countPhaseBenefitClaims"), "service counts claims");

  const prismaRepo = readFileSync(
    join(root, "lib/public-registration/infrastructure/prisma-public-registration-repository.ts"),
    "utf8",
  );
  assert(prismaRepo.includes("stockLimit"), "prisma maps stockLimit");
  assert(prismaRepo.includes("reservedItems"), "tx strips exhausted benefits");
  assert(
    !prismaRepo.includes("PHASE_CAPACITY_EXCEEDED") ||
      prismaRepo.includes("Does NOT throw PHASE_CAPACITY"),
    "first-N path documented as non-capacity",
  );

  const seedCfg = readFileSync(join(root, "config/editions/argentina-2026.ts"), "utf8");
  assert(seedCfg.includes("firstNBenefitLimit: 100"), "AR2026 firstN=100");
  assert(!seedCfg.includes("capacity: 100"), "AR2026 does not misuse capacity=100");

  console.log("first-n-benefit.selfcheck: ok");
}

main();
