import {
  createEmptyProductionReadinessInput,
  evaluateClickatonProductionPaymentReadiness,
  type ClickatonProductionPaymentReadinessInput,
  type ClickatonProductionPaymentReadinessResult,
} from "../readiness.js";
import type { PartnerPaymentConnectionStatus } from "../connection-states.js";
import { isTruthyFlag } from "./config.js";
import type { OwnerPaymentAccountRecord } from "./types.js";

export function mapOwnerAccountToConnectionStatus(
  account: OwnerPaymentAccountRecord | null | undefined,
): PartnerPaymentConnectionStatus {
  if (!account) return "NOT_CONNECTED";
  switch (account.status) {
    case "PENDING":
      return account.verifiedAt ? "VERIFIED" : "CONNECTED_UNVERIFIED";
    case "ACTIVE":
      return "ACTIVE";
    case "NEEDS_REAUTH":
      return "EXPIRED";
    case "REVOKED":
      return "REVOKED";
    case "DISABLED":
      return "DISABLED";
    default:
      return "ERROR";
  }
}

/**
 * Hydrate readiness from owner account + env flags (read-only).
 * Partners / agreement / production publish remain false until later stages.
 */
export function hydrateClickatonProductionPaymentReadiness(input: {
  ownerAccount?: OwnerPaymentAccountRecord | null;
  /** OAuth→FI Clickatón path is implemented in code as of I1. */
  oauthPartnerPathReady?: boolean;
  vaultReady?: boolean;
  ownerDecisionDefined?: boolean;
  webhookConfigured?: boolean;
  webhookSecretConfigured?: boolean;
  env?: NodeJS.ProcessEnv;
}): ClickatonProductionPaymentReadinessResult {
  const env = input.env ?? process.env;
  const ownerStatus = mapOwnerAccountToConnectionStatus(input.ownerAccount ?? null);

  const productionFlagsOff =
    !isTruthyFlag(env.DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED) &&
    !isTruthyFlag(env.DNX_MP_ORDERS_1N_STAGING_ENABLED) &&
    !isTruthyFlag(env.DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED) &&
    !isTruthyFlag(env.DNX_MP_ORDERS_1N_PRODUCTION_ENABLED);

  const snapshot: ClickatonProductionPaymentReadinessInput = {
    ...createEmptyProductionReadinessInput(),
    ownerStatus,
    ownerDecisionDefined: input.ownerDecisionDefined ?? true,
    oauthPartnerPathReady: input.oauthPartnerPathReady ?? true,
    vaultReady: input.vaultReady ?? true,
    webhookConfigured: input.webhookConfigured ?? false,
    webhookSecretConfigured: input.webhookSecretConfigured ?? false,
    productionFlagsOff,
    legacyCheckoutAvailable: true,
    // Partners / agreement still incomplete in I1
    rodriStatus: "NOT_CONNECTED",
    tammyStatus: "NOT_CONNECTED",
    rodriConsentActive: false,
    tammyConsentActive: false,
    agreementExists: false,
    distributionPublished: false,
    totalBps: 0,
  };

  return evaluateClickatonProductionPaymentReadiness(snapshot);
}
