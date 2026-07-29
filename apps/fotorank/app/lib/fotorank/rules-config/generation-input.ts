import type { ContestRulesConfiguration } from "./types";
import { hashContestRulesConfiguration } from "./hash";

/**
 * DTO estable para generación de bases (sin secretos ni IDs internos).
 */
export type ContestRulesGenerationInput = {
  contractVersion: "v1";
  configurationHash: string;
  identity: ContestRulesConfiguration["identity"];
  schedule: ContestRulesConfiguration["schedule"];
  participation: ContestRulesConfiguration["participation"];
  theme: ContestRulesConfiguration["theme"];
  categories: ContestRulesConfiguration["categories"];
  file: Omit<ContestRulesConfiguration["file"], "internalSafetyMaxFileSizeBytes"> & {
    internalSafetyMaxFileSizeBytes: undefined;
  };
  metadata: ContestRulesConfiguration["metadata"];
  editing: ContestRulesConfiguration["editing"];
  ai: ContestRulesConfiguration["ai"];
  rights: ContestRulesConfiguration["rights"];
  jury: ContestRulesConfiguration["jury"];
  prizes: ContestRulesConfiguration["prizes"];
  disqualifications: ContestRulesConfiguration["disqualifications"];
};

export function buildContestRulesGenerationInput(
  config: ContestRulesConfiguration,
): ContestRulesGenerationInput {
  const { internalSafetyMaxFileSizeBytes: _safety, ...filePublic } = config.file;
  void _safety;
  return {
    contractVersion: "v1",
    configurationHash: hashContestRulesConfiguration(config),
    identity: config.identity,
    schedule: config.schedule,
    participation: config.participation,
    theme: config.theme,
    categories: config.categories,
    file: { ...filePublic, internalSafetyMaxFileSizeBytes: undefined },
    metadata: config.metadata,
    editing: config.editing,
    ai: config.ai,
    rights: config.rights,
    jury: config.jury,
    prizes: config.prizes,
    disqualifications: config.disqualifications,
  };
}
