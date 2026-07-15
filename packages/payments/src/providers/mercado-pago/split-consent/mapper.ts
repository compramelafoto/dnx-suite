import type { SplitConsentStatus } from "../../../contracts/entities.js";
import type { MpSplitConsentStatus, MpSplitConsentSucceededItem } from "./contracts.js";

export function normalizeMpConsentStatus(status: string): SplitConsentStatus {
  const upper = status.toUpperCase();
  switch (upper) {
    case "PENDING":
    case "ACTIVE":
    case "REJECTED":
    case "CANCELED":
    case "EXPIRED":
      return upper;
    default:
      return "PENDING";
  }
}

export function mapMpConsentStatusToDomain(status: MpSplitConsentStatus | string): SplitConsentStatus {
  return normalizeMpConsentStatus(String(status));
}

export function mapDomainConsentStatusToMp(status: SplitConsentStatus): string {
  return status;
}

export function mapMpConsentReceiver(item: MpSplitConsentSucceededItem | {
  receiver_id: string;
  seller_email?: string;
  email?: string;
  status: MpSplitConsentStatus | string;
  invite_url?: string;
}): {
  receiverId: string;
  sellerEmail: string;
  status: SplitConsentStatus;
  inviteUrl?: string;
} {
  const sellerEmail =
    ("seller_email" in item ? item.seller_email : undefined) ??
    ("email" in item ? item.email : undefined) ??
    "";
  const base = {
    receiverId: item.receiver_id,
    sellerEmail,
    status: mapMpConsentStatusToDomain(item.status),
  };
  if (item.invite_url) {
    return { ...base, inviteUrl: item.invite_url };
  }
  return base;
}
