import { runPricingReviewValidate } from "./run-pricing-review-validate.js";

const result = await runPricingReviewValidate();
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
