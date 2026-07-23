import type {
  CanonicalOrderView,
  ExpectedOrdersObserveContext,
  OrdersObserveMismatch,
  SnapshotAssociation,
} from "./types.js";

function prefix(value: string | null | undefined, n = 10): string | null {
  if (!value) return null;
  return value.length <= n ? `${value.slice(0, 2)}…` : `${value.slice(0, n)}…`;
}

export function toCanonicalOrderView(input: {
  providerOrderId: string;
  status: string;
  statusDetail?: string | null;
  externalReference?: string | null;
  totalMinor?: string | null;
  currency?: string | null;
  splitAmounts?: string[];
  paymentCount?: number;
}): CanonicalOrderView {
  return {
    providerOrderId: input.providerOrderId,
    providerOrderIdPrefix: prefix(input.providerOrderId) ?? "…",
    status: input.status,
    statusDetail: input.statusDetail ?? null,
    externalReference: input.externalReference ?? null,
    totalMinor: input.totalMinor ?? null,
    currency: input.currency ?? null,
    recipientCount: input.splitAmounts?.length ?? 0,
    splitAmounts: input.splitAmounts ?? [],
    paymentCount: input.paymentCount ?? 0,
  };
}

export function reconcileWebhookAgainstGet(input: {
  webhookOrderId: string;
  canonical: CanonicalOrderView;
  expected?: ExpectedOrdersObserveContext;
}): OrdersObserveMismatch[] {
  const mismatches: OrdersObserveMismatch[] = [];
  if (input.webhookOrderId !== input.canonical.providerOrderId) {
    mismatches.push({
      code: "STATUS_MISMATCH",
      detail: "webhook_order_id_ne_get_order_id",
    });
  }

  const expected = input.expected;
  if (expected?.providerOrderId && expected.providerOrderId !== input.canonical.providerOrderId) {
    mismatches.push({
      code: "STATUS_MISMATCH",
      detail: "expected_provider_order_id_mismatch",
    });
  }
  if (expected?.status && expected.status !== input.canonical.status) {
    mismatches.push({
      code: "STATUS_MISMATCH",
      detail: `status_expected=${expected.status}_got=${input.canonical.status}`,
    });
  }
  if (
    expected?.externalReference &&
    input.canonical.externalReference &&
    expected.externalReference !== input.canonical.externalReference
  ) {
    mismatches.push({
      code: "STATUS_MISMATCH",
      detail: "external_reference_mismatch",
    });
  }
  if (
    expected?.totalMinor &&
    input.canonical.totalMinor &&
    expected.totalMinor !== input.canonical.totalMinor
  ) {
    mismatches.push({
      code: "AMOUNT_MISMATCH",
      detail: `total_expected=${expected.totalMinor}_got=${input.canonical.totalMinor}`,
    });
  }
  if (expected?.expectedBps && expected.expectedBps.length > 0) {
    const sortedExpected = [...expected.expectedBps].sort((a, b) => a - b);
    // Percentage splits arrive as decimal strings ("34.00"); convert to bps-ish check via sum.
    const amounts = input.canonical.splitAmounts.map((a) => Number(a));
    const sum = amounts.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
    if (Math.round(sum) !== 100 && Math.abs(sum - 100) > 0.01) {
      mismatches.push({
        code: "RECIPIENT_MISMATCH",
        detail: `split_percent_sum=${sum}_expected_bps=${sortedExpected.join("/")}`,
      });
    }
    if (input.canonical.recipientCount !== expected.expectedBps.length) {
      mismatches.push({
        code: "RECIPIENT_MISMATCH",
        detail: `recipient_count=${input.canonical.recipientCount}_expected=${expected.expectedBps.length}`,
      });
    }
  }
  return mismatches;
}

export function associateSnapshot(input: {
  canonical: CanonicalOrderView;
  expected?: ExpectedOrdersObserveContext;
  /** Fresh read of snapshot from DB (must match expected if provided). */
  snapshotRead?: ExpectedOrdersObserveContext["snapshot"] | null;
}): { association: SnapshotAssociation | null; mismatches: OrdersObserveMismatch[] } {
  const mismatches: OrdersObserveMismatch[] = [];
  const snap = input.snapshotRead ?? input.expected?.snapshot ?? null;
  if (!snap) {
    return { association: null, mismatches };
  }

  const intact =
    !input.expected?.snapshot ||
    (input.expected.snapshot.idPrefix === snap.idPrefix &&
      input.expected.snapshot.hashPrefix === snap.hashPrefix &&
      input.expected.snapshot.totalMinor === snap.totalMinor &&
      JSON.stringify([...input.expected.snapshot.bps].sort()) ===
        JSON.stringify([...snap.bps].sort()));

  if (!intact) {
    mismatches.push({
      code: "SNAPSHOT_MISMATCH",
      detail: "snapshot_mutated_or_regenerated",
    });
  }

  let matchedBy: SnapshotAssociation["matchedBy"] = "agreement_scope";
  if (
    input.canonical.externalReference &&
    snap.externalReference === input.canonical.externalReference
  ) {
    matchedBy = "external_reference";
  } else if (
    input.canonical.totalMinor &&
    snap.totalMinor === input.canonical.totalMinor &&
    input.expected?.expectedBps
  ) {
    matchedBy = "amount_and_bps";
  } else if (input.expected?.snapshot) {
    matchedBy = "metadata_ref";
  }

  return {
    association: {
      idPrefix: snap.idPrefix,
      hashPrefix: snap.hashPrefix,
      totalMinor: snap.totalMinor,
      bps: snap.bps,
      externalReference: snap.externalReference,
      agreementIdPrefix: snap.agreementIdPrefix,
      matchedBy,
      intact,
    },
    mismatches,
  };
}
