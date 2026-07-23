import type { OrdersObserveAlertCode, OrdersObserveCounters } from "./types.js";

export function createOrdersObserveCounters(): OrdersObserveCounters {
  return {
    received: 0,
    signatureOk: 0,
    signatureFail: 0,
    liveModeRejected: 0,
    duplicates: 0,
    processed: 0,
    mismatches: 0,
    retries: 0,
    deadLetters: 0,
    alerts: {},
  };
}

export function bumpAlert(
  counters: OrdersObserveCounters,
  code: OrdersObserveAlertCode,
): void {
  counters.alerts[code] = (counters.alerts[code] ?? 0) + 1;
}

/** Secret-free summary for logs / CLI reports. */
export function summarizeOrdersObserveCounters(
  counters: OrdersObserveCounters,
): Record<string, unknown> {
  return {
    received: counters.received,
    signatureOk: counters.signatureOk,
    signatureFail: counters.signatureFail,
    liveModeRejected: counters.liveModeRejected,
    duplicates: counters.duplicates,
    processed: counters.processed,
    mismatches: counters.mismatches,
    retries: counters.retries,
    deadLetters: counters.deadLetters,
    alerts: { ...counters.alerts },
  };
}
