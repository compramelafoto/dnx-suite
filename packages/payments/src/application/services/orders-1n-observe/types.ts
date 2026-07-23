import type { MappedOrderStatus } from "../../../providers/mercado-pago/orders/mapper.js";

export type OrdersObserveAlertCode =
  | "SIGNATURE_FAIL"
  | "LIVE_MODE_FORBIDDEN"
  | "OBSERVE_FLAG_OFF"
  | "STATUS_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "RECIPIENT_MISMATCH"
  | "SNAPSHOT_MISMATCH"
  | "GET_ORDER_FAILED"
  | "DEAD_LETTER"
  | "RETRY_SCHEDULED";

export type OrdersObserveCounters = {
  received: number;
  signatureOk: number;
  signatureFail: number;
  liveModeRejected: number;
  duplicates: number;
  processed: number;
  mismatches: number;
  retries: number;
  deadLetters: number;
  alerts: Partial<Record<OrdersObserveAlertCode, number>>;
};

export type OrdersObserveMismatch = {
  code: OrdersObserveAlertCode;
  detail: string;
};

export type SnapshotAssociation = {
  idPrefix: string;
  hashPrefix: string;
  totalMinor: string;
  bps: number[];
  externalReference: string;
  agreementIdPrefix: string;
  matchedBy: "external_reference" | "agreement_scope" | "amount_and_bps" | "metadata_ref";
  intact: boolean;
};

export type CanonicalOrderView = {
  providerOrderId: string;
  providerOrderIdPrefix: string;
  status: MappedOrderStatus | string;
  statusDetail: string | null;
  externalReference: string | null;
  totalMinor: string | null;
  currency: string | null;
  recipientCount: number;
  splitAmounts: string[];
  paymentCount: number;
};

export type OrdersObserveResult =
  | {
      ok: true;
      outcome: "processed" | "duplicate";
      eventId: string;
      providerOrderIdPrefix: string;
      liveMode: boolean;
      inboxId: string;
      canonical: CanonicalOrderView | null;
      snapshot: SnapshotAssociation | null;
      mismatches: OrdersObserveMismatch[];
      alerts: OrdersObserveAlertCode[];
      deliveryClass:
        | "HTTP_DELIVERED_FROM_MP"
        | "SIGNED_REPLAY_OF_SANDBOX_ORDER"
        | "UNSIGNED_REJECTED";
    }
  | {
      ok: false;
      code: string;
      alerts: OrdersObserveAlertCode[];
      detail?: string;
    };

export type ExpectedOrdersObserveContext = {
  providerOrderId?: string;
  externalReference?: string;
  status?: string;
  totalMinor?: string;
  expectedBps?: number[];
  receiverPrefixes?: string[];
  snapshot?: {
    idPrefix: string;
    hashPrefix: string;
    totalMinor: string;
    bps: number[];
    externalReference: string;
    agreementIdPrefix: string;
  };
};
