/**
 * DTOs aligned with PRIVATE_MP_1N Orders API Split Consent (v1.6.0).
 * Statuses accepted in both upper and lower case from provider responses.
 */

export type MpSplitConsentStatus =
  | "PENDING"
  | "ACTIVE"
  | "REJECTED"
  | "CANCELED"
  | "EXPIRED"
  | "pending"
  | "active"
  | "rejected"
  | "canceled"
  | "expired";

export interface MpSplitConsentInviteItem {
  seller_email: string;
}

export interface MpSplitConsentCreateRequest {
  invites: MpSplitConsentInviteItem[];
}

export interface MpSplitConsentSucceededItem {
  seller_email: string;
  receiver_id: string;
  status: MpSplitConsentStatus;
  invite_url?: string;
}

export interface MpSplitConsentFailedItem {
  seller_email?: string;
  error?: string;
  code?: string;
  message?: string;
}

export interface MpSplitConsentCreateResponse {
  succeeded: MpSplitConsentSucceededItem[];
  failed: MpSplitConsentFailedItem[];
}

export interface MpSplitConsentListResult {
  receiver_id: string;
  seller_email: string;
  status: MpSplitConsentStatus;
  created_at?: string;
  updated_at?: string;
  invite_url?: string;
}

export interface MpSplitConsentListResponse {
  paging?: { total: number; offset: number; limit: number };
  results: MpSplitConsentListResult[];
}

export interface MpSplitConsentPatchRequest {
  status: "CANCELED";
}

export interface MpSplitConsentPatchResponse {
  receiver_id?: string;
  status: MpSplitConsentStatus;
}

/** @deprecated use MpSplitConsentSucceededItem */
export type MpSplitConsentReceiver = MpSplitConsentSucceededItem & {
  email?: string;
};

/** Partial HTTP 207 body */
export interface MpSplitConsentPartialResult {
  succeeded: MpSplitConsentSucceededItem[];
  failed: MpSplitConsentFailedItem[];
}
