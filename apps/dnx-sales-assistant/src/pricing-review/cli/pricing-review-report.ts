import { runPricingReviewReport } from "./run-pricing-review-report.js";

const result = await runPricingReviewReport();
for (const line of result.lines) console.log(line);
process.exit(result.exitCode);
