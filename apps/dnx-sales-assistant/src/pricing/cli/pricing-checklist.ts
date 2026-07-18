import { runPricingChecklist } from "./run-pricing-checklist.js";

const result = runPricingChecklist();
for (const line of result.lines) {
  console.log(line);
}
process.exit(result.exitCode);
