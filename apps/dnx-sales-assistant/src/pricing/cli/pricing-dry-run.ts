import { runPricingDryRunCli } from "./run-pricing-dry-run.js";

function parseArgs(argv: string[]): {
  profilePath?: string;
  templatesPath?: string;
  jobPath?: string;
} {
  let profilePath: string | undefined =
    process.env.DNX_PRICING_PROFILE_PATH || undefined;
  let templatesPath: string | undefined =
    process.env.DNX_PRICING_TEMPLATES_PATH || undefined;
  let jobPath: string | undefined =
    process.env.DNX_PRICING_JOB_PATH || undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--profile" && argv[i + 1]) {
      profilePath = argv[++i];
    } else if (arg === "--templates" && argv[i + 1]) {
      templatesPath = argv[++i];
    } else if (arg === "--job" && argv[i + 1]) {
      jobPath = argv[++i];
    }
  }

  return { profilePath, templatesPath, jobPath };
}

const result = await runPricingDryRunCli(parseArgs(process.argv.slice(2)));
for (const line of result.lines) {
  console.log(line);
}
process.exit(result.exitCode);
