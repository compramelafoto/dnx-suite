import { runPricingReviewScenario } from "./run-pricing-review-scenario.js";

const id = process.argv[2];
if (!id) {
  console.error("Uso: pricing-review:scenario <scenario-id>");
  process.exit(1);
}
const result = await runPricingReviewScenario(id);
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
