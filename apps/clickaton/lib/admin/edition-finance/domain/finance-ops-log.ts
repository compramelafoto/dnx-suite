/**
 * Logs internos seguros de finanzas / checkout (sin tokens ni PII sensible).
 */

export type FinanceOpsLogEvent =
  | "finance_active_distribution_resolved"
  | "finance_active_distribution_missing"
  | "finance_gate_evaluated"
  | "finance_snapshot_attached"
  | "finance_snapshot_blocked"
  | "finance_draft_account_mutation_skipped";

export type FinanceOpsLogPayload = {
  event: FinanceOpsLogEvent;
  editionId?: string;
  agreementId?: string | null;
  distributionVersionId?: string | null;
  distributionVersionNumber?: number | null;
  versionStatus?: string | null;
  agreementStatus?: string | null;
  reason?: string;
  blockers?: string[];
  ok?: boolean;
  mode?: string;
  registrationId?: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
};

export function logFinanceOps(payload: FinanceOpsLogPayload): void {
  try {
    // eslint-disable-next-line no-console -- ops signal for support / Vercel logs
    console.info("[clickaton:finance-ops]", JSON.stringify(payload));
  } catch {
    // never throw from logging
  }
}
