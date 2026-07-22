import type { FinancialEnvironment } from "../../financial-identity/types.js";
import type {
  LegacyClfMpDryRunResult,
  LegacyClfMpPaymentAccountCandidate,
  LegacyClfMpUserRow,
} from "./types.js";

/**
 * Pure mapper: User.mpUserId → PaymentAccount candidate.
 * Does NOT copy tokens. Does NOT write DB. Does NOT activate dual-read.
 */
export function mapLegacyClfUserMpToPaymentAccountCandidate(
  row: LegacyClfMpUserRow,
  environment: FinancialEnvironment = "PROD",
): LegacyClfMpPaymentAccountCandidate | null {
  if (!row.mpUserId) return null;
  return {
    ownerUserId: row.userId,
    provider: "MERCADOPAGO",
    environment,
    providerUserId: row.mpUserId,
    originApp: "compramelafoto",
    capabilities: ["COLLECTOR", "SPLIT_RECEIVER"],
    status: "ACTIVE",
    credentialReference: null,
  };
}

export function dryRunMapLegacyClfMpUsers(
  rows: readonly LegacyClfMpUserRow[],
  environment: FinancialEnvironment = "PROD",
): LegacyClfMpDryRunResult {
  const mapped: LegacyClfMpPaymentAccountCandidate[] = [];
  const skipped: LegacyClfMpDryRunResult["skipped"] = [];
  const byProviderUser = new Map<string, number[]>();

  for (const row of rows) {
    const candidate = mapLegacyClfUserMpToPaymentAccountCandidate(row, environment);
    if (!candidate) {
      skipped.push({ userId: row.userId, reason: "missing_mpUserId" });
      continue;
    }
    mapped.push(candidate);
    const list = byProviderUser.get(candidate.providerUserId) ?? [];
    list.push(row.userId);
    byProviderUser.set(candidate.providerUserId, list);
  }

  const conflicts: LegacyClfMpDryRunResult["conflicts"] = [];
  for (const [providerUserId, userIds] of byProviderUser) {
    if (userIds.length > 1) {
      conflicts.push({ providerUserId, userIds });
    }
  }

  return { mapped, skipped, conflicts };
}
