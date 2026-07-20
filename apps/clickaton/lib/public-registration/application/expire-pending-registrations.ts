import type { PublicRegistrationRepository } from "../domain/repository";
import type { ExpirePendingBatchResult } from "../domain/types";

export type ExpirePendingRegistrationsInput = {
  now?: Date;
  limit?: number;
  dryRun?: boolean;
};

/**
 * Caso de uso batch: expirePendingRegistrations.
 * Ejecutable desde script, selfcheck o futuro worker — sin UI.
 */
export function createExpirePendingRegistrationsUseCase(deps: {
  repo: PublicRegistrationRepository;
}) {
  const { repo } = deps;

  return {
    async execute(input: ExpirePendingRegistrationsInput = {}): Promise<ExpirePendingBatchResult> {
      const now = input.now ?? new Date();
      const limit = Math.min(Math.max(input.limit ?? 50, 1), 500);
      const dryRun = Boolean(input.dryRun);

      const candidates = await repo.listExpireCandidates({ now, limit });
      const result: ExpirePendingBatchResult = {
        scanned: candidates.length,
        expired: 0,
        skipped: 0,
        failed: 0,
        releasedCapacityHolds: 0,
        releasedStockHolds: 0,
        errors: [],
        dryRun,
      };

      for (const registrationId of candidates) {
        try {
          const outcome = await repo.expireRegistration({
            registrationId,
            now,
            dryRun,
          });
          if (outcome.outcome === "expired") {
            result.expired += 1;
            result.releasedCapacityHolds += outcome.releasedCapacityHolds;
            result.releasedStockHolds += outcome.releasedStockHolds;
          } else if (outcome.outcome === "already_processed") {
            result.skipped += 1;
          } else {
            result.skipped += 1;
          }
        } catch {
          result.failed += 1;
          result.errors.push({ registrationId, code: "UNEXPECTED" });
        }
      }

      return result;
    },
  };
}

export type ExpirePendingRegistrationsUseCase = ReturnType<
  typeof createExpirePendingRegistrationsUseCase
>;
