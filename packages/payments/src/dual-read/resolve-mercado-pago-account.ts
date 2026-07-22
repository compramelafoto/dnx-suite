import { sanitizeCredentialAuditMeta, sanitizeMpUserId } from "../credential-vault/index.js";
import type { FinancialEnvironment, PaymentAccountCapability } from "../financial-identity/types.js";
import {
  loadFinancialIdentityFlags,
  type FinancialIdentityFlags,
} from "./flags.js";
import type {
  DualReadPorts,
  ResolveMercadoPagoAccountResult,
} from "./types.js";

export async function resolveMercadoPagoAccountForUser(
  ports: DualReadPorts,
  input: {
    userId: number;
    environment: FinancialEnvironment;
    requiredCapability?: PaymentAccountCapability;
    productKey?: string;
    flags?: FinancialIdentityFlags;
  },
): Promise<ResolveMercadoPagoAccountResult> {
  const flags = input.flags ?? loadFinancialIdentityFlags();
  const legacy = await ports.loadLegacyUserMp(input.userId);

  if (flags.readMode === "LEGACY_ONLY") {
    return fromLegacyUser(legacy, input.environment, false);
  }

  const fiAccount = await ports.findActivePaymentAccountForUser({
    userId: input.userId,
    environment: input.environment,
    requiredCapability: input.requiredCapability,
  });

  if (flags.readMode === "FINANCIAL_IDENTITY_ONLY") {
    if (!fiAccount?.credentialReference) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "financial identity account not found",
        source: "financial_identity",
      };
    }
    return decryptFi(ports, fiAccount, input.environment, false);
  }

  // PREFER_FINANCIAL_IDENTITY
  if (fiAccount?.credentialReference && fiAccount.status === "ACTIVE") {
    const decrypted = await decryptFi(ports, fiAccount, input.environment, false);
    if (!decrypted.ok) return decrypted;

    if (
      legacy?.mpUserId &&
      decrypted.mpUserId &&
      legacy.mpUserId !== decrypted.mpUserId
    ) {
      ports.recordAudit?.({
        action: "PAYMENT_ACCOUNT_CONFLICT",
        aggregateType: "User",
        aggregateId: String(input.userId),
        result: "DENIED",
        metadata: sanitizeCredentialAuditMeta({
          legacyMpUserId: sanitizeMpUserId(legacy.mpUserId),
          fiMpUserId: sanitizeMpUserId(decrypted.mpUserId),
          productKey: input.productKey ?? null,
        }),
      });
      return {
        ok: false,
        code: "CONFLICT",
        message: "legacy mpUserId does not match financial identity account",
        source: "conflict_blocked",
      };
    }

    ports.recordAudit?.({
      action: "FINANCIAL_ACCOUNT_RESOLVED",
      aggregateType: "PaymentAccount",
      aggregateId: fiAccount.paymentAccountId,
      result: "SUCCEEDED",
      metadata: sanitizeCredentialAuditMeta({
        userId: input.userId,
        source: "financial_identity",
        environment: input.environment,
      }),
    });
    return decrypted;
  }

  const fallback = fromLegacyUser(legacy, input.environment, true);
  if (fallback.ok) {
    ports.recordAudit?.({
      action: "LEGACY_FALLBACK_USED",
      aggregateType: "User",
      aggregateId: String(input.userId),
      result: "SUCCEEDED",
      metadata: sanitizeCredentialAuditMeta({
        environment: input.environment,
        productKey: input.productKey ?? null,
      }),
    });
  }
  return fallback;
}

export async function resolveMercadoPagoAccountForLab(
  ports: DualReadPorts,
  input: {
    labId: number;
    environment: FinancialEnvironment;
    flags?: FinancialIdentityFlags;
  },
): Promise<ResolveMercadoPagoAccountResult> {
  const flags = input.flags ?? loadFinancialIdentityFlags();
  const legacy = await ports.loadLegacyLabMp(input.labId);

  if (flags.readMode === "LEGACY_ONLY") {
    return fromLegacyLab(legacy, input.environment, false);
  }

  const fiAccount = await ports.findActivePaymentAccountForLab({
    labId: input.labId,
    environment: input.environment,
  });

  if (flags.readMode === "FINANCIAL_IDENTITY_ONLY") {
    if (!fiAccount?.credentialReference) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "lab financial identity account not found",
        source: "financial_identity",
      };
    }
    return decryptFi(ports, fiAccount, input.environment, false);
  }

  if (fiAccount?.credentialReference && fiAccount.status === "ACTIVE") {
    const decrypted = await decryptFi(ports, fiAccount, input.environment, false);
    if (!decrypted.ok) return decrypted;
    if (
      legacy?.mpUserId &&
      decrypted.mpUserId &&
      legacy.mpUserId !== decrypted.mpUserId
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "lab legacy mpUserId does not match financial identity",
        source: "conflict_blocked",
      };
    }
    return decrypted;
  }

  return fromLegacyLab(legacy, input.environment, true);
}

async function decryptFi(
  ports: DualReadPorts,
  fiAccount: {
    paymentAccountId: string;
    financialIdentityId: string;
    providerUserId: string | null;
    credentialReference: string | null;
  },
  environment: FinancialEnvironment,
  usedLegacyFallback: boolean,
): Promise<ResolveMercadoPagoAccountResult> {
  if (!fiAccount.credentialReference) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "missing credential reference",
      source: "financial_identity",
    };
  }
  try {
    const creds = await ports.decryptCredential(fiAccount.credentialReference);
    return {
      ok: true,
      accessToken: creds.accessToken,
      mpUserId: creds.providerUserId || fiAccount.providerUserId,
      source: "financial_identity",
      environment,
      paymentAccountId: fiAccount.paymentAccountId,
      financialIdentityId: fiAccount.financialIdentityId,
      usedLegacyFallback,
    };
  } catch {
    ports.recordAudit?.({
      action: "CREDENTIAL_DECRYPT_FAILED",
      aggregateType: "EncryptedCredential",
      aggregateId: fiAccount.credentialReference,
      result: "FAILED",
      metadata: { paymentAccountId: fiAccount.paymentAccountId },
    });
    return {
      ok: false,
      code: "DECRYPT_FAILED",
      message: "credential decrypt failed",
      source: "financial_identity",
    };
  }
}

function fromLegacyUser(
  legacy: { userId: number; mpUserId: string | null; mpAccessToken: string | null } | null,
  environment: FinancialEnvironment,
  usedLegacyFallback: boolean,
): ResolveMercadoPagoAccountResult {
  const token = legacy?.mpAccessToken?.trim();
  if (!legacy || !token) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "legacy user MP credentials not found",
      source: "legacy_user",
    };
  }
  return {
    ok: true,
    accessToken: token,
    mpUserId: legacy.mpUserId,
    source: "legacy_user",
    environment,
    paymentAccountId: null,
    financialIdentityId: null,
    usedLegacyFallback,
  };
}

function fromLegacyLab(
  legacy: { labId: number; mpUserId: string | null; mpAccessToken: string | null } | null,
  environment: FinancialEnvironment,
  usedLegacyFallback: boolean,
): ResolveMercadoPagoAccountResult {
  const token = legacy?.mpAccessToken?.trim();
  if (!legacy || !token) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "legacy lab MP credentials not found",
      source: "legacy_lab",
    };
  }
  return {
    ok: true,
    accessToken: token,
    mpUserId: legacy.mpUserId,
    source: "legacy_lab",
    environment,
    paymentAccountId: null,
    financialIdentityId: null,
    usedLegacyFallback,
  };
}
