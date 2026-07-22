import type { FinancialEnvironment } from "../../financial-identity/types.js";

/** Sanitized User.mp* projection — never includes tokens. */
export interface LegacyClfMpUserRow {
  userId: number;
  mpUserId: string | null;
  mpConnectedAt: Date | null;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
}

export interface LegacyClfMpPaymentAccountCandidate {
  ownerUserId: number;
  provider: "MERCADOPAGO";
  environment: FinancialEnvironment;
  providerUserId: string;
  originApp: "compramelafoto";
  capabilities: Array<"COLLECTOR" | "SPLIT_RECEIVER">;
  status: "ACTIVE";
  /** Always null in dry-run — vault migration is 10D3I-D. */
  credentialReference: null;
}

export interface LegacyClfMpDryRunResult {
  mapped: LegacyClfMpPaymentAccountCandidate[];
  skipped: Array<{ userId: number; reason: string }>;
  conflicts: Array<{ providerUserId: string; userIds: number[] }>;
}
