import { runPricingReviewChecklist } from "./run-pricing-review-checklist.js";

const result = runPricingReviewChecklist();
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
