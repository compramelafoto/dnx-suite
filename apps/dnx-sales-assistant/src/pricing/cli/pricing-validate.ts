import { runPricingValidate } from "./run-pricing-validate.js";

function parseArgs(argv: string[]): { profilePath?: string; templatesPath?: string } {
  let profilePath: string | undefined =
    process.env.DNX_PRICING_PROFILE_PATH || undefined;
  let templatesPath: string | undefined =
    process.env.DNX_PRICING_TEMPLATES_PATH || undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--profile" && argv[i + 1]) {
      profilePath = argv[++i];
    } else if (arg === "--templates" && argv[i + 1]) {
      templatesPath = argv[++i];
    }
  }
  return { profilePath, templatesPath };
}

const result = runPricingValidate(parseArgs(process.argv.slice(2)));
for (const line of result.lines) {
  console.log(line);
}
process.exit(result.exitCode);
