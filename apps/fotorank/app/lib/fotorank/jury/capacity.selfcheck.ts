/**
 * Selfcheck puro del calculador de capacidad (ETAPA 16A).
 * pnpm --filter @repo/db exec tsx ../../apps/fotorank/app/lib/fotorank/jury/capacity.selfcheck.ts
 */
import { computeJuryCapacity } from "./capacity-calculator";

let failed = 0;
function ok(cond: boolean, label: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", label);
  }
}

const cap6 = computeJuryCapacity({
  estimatedEntries: 1000,
  requiredEvaluationsPerEntry: 3,
  recommendedMaxEntriesPerJudge: 500,
  acceptedJudges: 6,
});
ok(cap6.totalEvaluations === 3000, "3000 evaluations");
ok(cap6.recommendedJudges === 6, "6 judges");
ok(cap6.loadPerJudge === 500, "500 load");
ok(cap6.semaphore === "green", "green");

const cap5 = computeJuryCapacity({
  estimatedEntries: 1000,
  requiredEvaluationsPerEntry: 3,
  recommendedMaxEntriesPerJudge: 500,
  acceptedJudges: 5,
});
ok(cap5.deficit === 1, "deficit 1");
ok(cap5.semaphore === "amber", "amber at 600");

ok(
  computeJuryCapacity({ estimatedEntries: 100, acceptedJudges: 0 }).semaphore === "red",
  "red without judges",
);

if (failed) {
  console.error(JSON.stringify({ ok: false, failed }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checks: 7 }));
