/**
 * Read-only production payment readiness for Clickatón partners (10D3I-I0).
 * Never calls Mercado Pago. Never opens OAuth. Uses an explicit snapshot input
 * (mocks / future hydrated graph). Default snapshot = all blockers present.
 */

import { CLICKATON_PRODUCTION_TARGET_BPS } from "./governance.js";
import type { PartnerPaymentConnectionStatus } from "./connection-states.js";

export type ReadinessGateId =
  | "ownerConnected"
  | "ownerVerified"
  | "partnerRodrigoConnected"
  | "partnerRodrigoConsentActive"
  | "partnerTamaraConnected"
  | "partnerTamaraConsentActive"
  | "agreementExists"
  | "distributionPublished"
  | "totalBpsValid"
  | "webhookConfigured"
  | "webhookSecretConfigured"
  | "productionFlagsOff"
  | "legacyCheckoutAvailable"
  | "ownerDecisionDefined"
  | "vaultReady"
  | "oauthPartnerPathReady";

export type ClickatonProductionPaymentReadinessInput = {
  ownerStatus: PartnerPaymentConnectionStatus;
  rodriStatus: PartnerPaymentConnectionStatus;
  tammyStatus: PartnerPaymentConnectionStatus;
  rodriConsentActive: boolean;
  tammyConsentActive: boolean;
  agreementExists: boolean;
  distributionPublished: boolean;
  totalBps: number;
  webhookConfigured: boolean;
  webhookSecretConfigured: boolean;
  /** When true, production Orders/checkout flags are OFF (safe). */
  productionFlagsOff: boolean;
  legacyCheckoutAvailable: boolean;
  /** Administrative decision: which MP seller is the Orders owner. */
  ownerDecisionDefined: boolean;
  vaultReady: boolean;
  /** Clickatón-specific OAuth→FI path exists (not CLF User.mp*). */
  oauthPartnerPathReady: boolean;
};

export type ReadinessGateRow = {
  gate: ReadinessGateId;
  ok: boolean;
  blocking: boolean;
  detail: string;
};

export type ClickatonProductionPaymentReadinessResult = {
  gates: ReadinessGateRow[];
  blockers: string[];
  warnings: string[];
  ownerConnected: boolean;
  ownerVerified: boolean;
  partnerRodrigoConnected: boolean;
  partnerRodrigoConsentActive: boolean;
  partnerTamaraConnected: boolean;
  partnerTamaraConsentActive: boolean;
  agreementExists: boolean;
  distributionPublished: boolean;
  totalBpsValid: boolean;
  webhookConfigured: boolean;
  webhookSecretConfigured: boolean;
  productionFlagsOff: boolean;
  legacyCheckoutAvailable: boolean;
  readyForDryRun: boolean;
  readyForMicroTransaction: boolean;
  readyForCutover: boolean;
  targetBps: typeof CLICKATON_PRODUCTION_TARGET_BPS;
};

function isConnected(status: PartnerPaymentConnectionStatus): boolean {
  return (
    status === "ACTIVE" ||
    status === "VERIFIED" ||
    status === "CONSENT_PENDING" ||
    status === "CONNECTED_UNVERIFIED"
  );
}

function isVerifiedOrActive(status: PartnerPaymentConnectionStatus): boolean {
  return status === "ACTIVE" || status === "VERIFIED" || status === "CONSENT_PENDING";
}

/** Safe default: nothing real connected — all hard gates fail closed. */
export function createEmptyProductionReadinessInput(): ClickatonProductionPaymentReadinessInput {
  return {
    ownerStatus: "NOT_CONNECTED",
    rodriStatus: "NOT_CONNECTED",
    tammyStatus: "NOT_CONNECTED",
    rodriConsentActive: false,
    tammyConsentActive: false,
    agreementExists: false,
    distributionPublished: false,
    totalBps: 0,
    webhookConfigured: false,
    webhookSecretConfigured: false,
    productionFlagsOff: true,
    legacyCheckoutAvailable: true,
    ownerDecisionDefined: false,
    vaultReady: true,
    oauthPartnerPathReady: false,
  };
}

/**
 * Simulated “complete” graph for unit tests only — never implies live accounts.
 */
export function createSimulatedCompleteReadinessInput(): ClickatonProductionPaymentReadinessInput {
  return {
    ownerStatus: "ACTIVE",
    rodriStatus: "ACTIVE",
    tammyStatus: "ACTIVE",
    rodriConsentActive: true,
    tammyConsentActive: true,
    agreementExists: true,
    distributionPublished: true,
    totalBps: 10_000,
    webhookConfigured: true,
    webhookSecretConfigured: true,
    productionFlagsOff: true,
    legacyCheckoutAvailable: true,
    ownerDecisionDefined: true,
    vaultReady: true,
    oauthPartnerPathReady: true,
  };
}

export function evaluateClickatonProductionPaymentReadiness(
  input: ClickatonProductionPaymentReadinessInput = createEmptyProductionReadinessInput(),
): ClickatonProductionPaymentReadinessResult {
  const ownerConnected = isConnected(input.ownerStatus);
  const ownerVerified = isVerifiedOrActive(input.ownerStatus) && input.ownerStatus === "ACTIVE";
  const partnerRodrigoConnected = isConnected(input.rodriStatus);
  const partnerTamaraConnected = isConnected(input.tammyStatus);
  const partnerRodrigoConsentActive =
    input.rodriConsentActive && input.rodriStatus === "ACTIVE";
  const partnerTamaraConsentActive =
    input.tammyConsentActive && input.tammyStatus === "ACTIVE";
  const totalBpsValid = input.totalBps === 10_000;

  const gates: ReadinessGateRow[] = [
    {
      gate: "ownerDecisionDefined",
      ok: input.ownerDecisionDefined,
      blocking: true,
      detail: input.ownerDecisionDefined
        ? "Owner MP seller decision recorded"
        : "Daniel must define Clickatón Orders owner MP account",
    },
    {
      gate: "oauthPartnerPathReady",
      ok: input.oauthPartnerPathReady,
      blocking: true,
      detail: input.oauthPartnerPathReady
        ? "Clickatón OAuth→FI path ready"
        : "Partner OAuth→FinancialIdentity path not implemented (CLF legacy only)",
    },
    {
      gate: "vaultReady",
      ok: input.vaultReady,
      blocking: true,
      detail: input.vaultReady
        ? "Credential vault available"
        : "Vault / master key not ready",
    },
    {
      gate: "ownerConnected",
      ok: ownerConnected,
      blocking: true,
      detail: `owner=${input.ownerStatus}`,
    },
    {
      gate: "ownerVerified",
      ok: ownerVerified,
      blocking: true,
      detail: ownerVerified ? "owner ACTIVE" : "owner not ACTIVE",
    },
    {
      gate: "partnerRodrigoConnected",
      ok: partnerRodrigoConnected,
      blocking: true,
      detail: `rodri=${input.rodriStatus}`,
    },
    {
      gate: "partnerRodrigoConsentActive",
      ok: partnerRodrigoConsentActive,
      blocking: true,
      detail: partnerRodrigoConsentActive ? "consent ACTIVE" : "consent missing",
    },
    {
      gate: "partnerTamaraConnected",
      ok: partnerTamaraConnected,
      blocking: true,
      detail: `tammy=${input.tammyStatus}`,
    },
    {
      gate: "partnerTamaraConsentActive",
      ok: partnerTamaraConsentActive,
      blocking: true,
      detail: partnerTamaraConsentActive ? "consent ACTIVE" : "consent missing",
    },
    {
      gate: "agreementExists",
      ok: input.agreementExists,
      blocking: true,
      detail: input.agreementExists ? "agreement present" : "production agreement missing",
    },
    {
      gate: "distributionPublished",
      ok: input.distributionPublished,
      blocking: true,
      detail: input.distributionPublished
        ? "DistributionVersion PUBLISHED"
        : "no published production DistributionVersion",
    },
    {
      gate: "totalBpsValid",
      ok: totalBpsValid,
      blocking: true,
      detail: `totalBps=${input.totalBps} (need 10000)`,
    },
    {
      gate: "webhookConfigured",
      ok: input.webhookConfigured,
      blocking: true,
      detail: input.webhookConfigured ? "webhook URL configured" : "webhook URL missing",
    },
    {
      gate: "webhookSecretConfigured",
      ok: input.webhookSecretConfigured,
      blocking: true,
      detail: input.webhookSecretConfigured
        ? "webhook secret configured"
        : "webhook secret missing",
    },
    {
      gate: "productionFlagsOff",
      ok: input.productionFlagsOff,
      blocking: true,
      detail: input.productionFlagsOff
        ? "production payment flags OFF (safe)"
        : "production flags unexpectedly ON",
    },
    {
      gate: "legacyCheckoutAvailable",
      ok: input.legacyCheckoutAvailable,
      blocking: false,
      detail: input.legacyCheckoutAvailable
        ? "legacy checkout available as fallback"
        : "legacy checkout unavailable",
    },
  ];

  const blockers = gates.filter((g) => g.blocking && !g.ok).map((g) => g.gate);
  const warnings = gates.filter((g) => !g.blocking && !g.ok).map((g) => g.gate);

  const coreAccountsReady =
    ownerVerified &&
    partnerRodrigoConsentActive &&
    partnerTamaraConsentActive &&
    input.agreementExists &&
    input.distributionPublished &&
    totalBpsValid &&
    input.ownerDecisionDefined &&
    input.oauthPartnerPathReady &&
    input.vaultReady;

  const opsReady =
    input.webhookConfigured &&
    input.webhookSecretConfigured &&
    input.productionFlagsOff;

  // Dry-run: data/governance complete with production create flags still OFF.
  // Microtransaction / cutover stay false until dedicated later stages (I6/I9).
  return {
    gates,
    blockers,
    warnings,
    ownerConnected,
    ownerVerified,
    partnerRodrigoConnected,
    partnerRodrigoConsentActive,
    partnerTamaraConnected,
    partnerTamaraConsentActive,
    agreementExists: input.agreementExists,
    distributionPublished: input.distributionPublished,
    totalBpsValid,
    webhookConfigured: input.webhookConfigured,
    webhookSecretConfigured: input.webhookSecretConfigured,
    productionFlagsOff: input.productionFlagsOff,
    legacyCheckoutAvailable: input.legacyCheckoutAvailable,
    readyForDryRun: coreAccountsReady && opsReady,
    readyForMicroTransaction: false,
    readyForCutover: false,
    targetBps: CLICKATON_PRODUCTION_TARGET_BPS,
  };
}
