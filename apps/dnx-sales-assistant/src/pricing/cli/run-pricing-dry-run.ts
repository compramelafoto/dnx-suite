import {
  defaultJobLocalPath,
  defaultProfileLocalPath,
  defaultTemplatesLocalPath,
} from "../config/paths.js";
import { runPricingDryRun } from "../offline/run-pricing-dry-run.js";
import { summaryContainsMoneyLikeValues } from "../config/summarize-pricing-configuration.js";

export type PricingDryRunCliOptions = {
  profilePath?: string;
  templatesPath?: string;
  jobPath?: string;
};

/**
 * CLI dry-run. Con locales ausentes: exit ≠ 0, sin montos, sin stack.
 */
export async function runPricingDryRunCli(
  options: PricingDryRunCliOptions = {},
): Promise<{ exitCode: number; lines: string[] }> {
  const profilePath = options.profilePath ?? defaultProfileLocalPath();
  const templatesPath = options.templatesPath ?? defaultTemplatesLocalPath();
  const jobPath = options.jobPath ?? defaultJobLocalPath();

  const result = await runPricingDryRun({
    profilePath,
    templatesPath,
    jobPath,
  });

  const lines = [...result.lines];

  // Si falló temprano (archivos ausentes), garantizar ausencia de montos.
  if (result.exitCode !== 0) {
    const text = lines.join("\n");
    if (summaryContainsMoneyLikeValues(text)) {
      return {
        exitCode: 2,
        lines: [
          ...lines,
          "ERROR interno: el output de error no debe contener montos.",
        ],
      };
    }
  }

  return { exitCode: result.exitCode, lines };
}
