import type { PrismaClient } from "@prisma/client";
import type { FinancialEnvironment } from "../../financial-identity/types.js";
import type {
  OwnerFinancialIdentityRecord,
  OwnerOAuthAuditEvent,
  OwnerOAuthStateRecord,
  OwnerPaymentAccountRecord,
} from "./types.js";
import type { OwnerOAuthStore } from "./store.js";
import {
  CLICKATON_MP_OWNER_DEDICATED_MARKER,
  CLICKATON_MP_OWNER_ORG_REF,
} from "./config.js";

type PrismaLike = {
  dnxMercadoPagoOAuthState: {
    create(args: { data: Record<string, unknown> }): Promise<OwnerOAuthStateRecord>;
    findUnique(args: {
      where: { stateHash: string };
    }): Promise<OwnerOAuthStateRecord | null>;
    update(args: {
      where: { id: string };
      data: { usedAt: Date };
    }): Promise<unknown>;
  };
  dnxFinancialIdentity: {
    findFirst(args: unknown): Promise<OwnerFinancialIdentityRecord | null>;
    create(args: { data: Record<string, unknown> }): Promise<OwnerFinancialIdentityRecord>;
  };
  dnxPaymentAccount: {
    findFirst(args: unknown): Promise<OwnerPaymentAccountRecord | null>;
    create(args: { data: Record<string, unknown> }): Promise<OwnerPaymentAccountRecord>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<OwnerPaymentAccountRecord>;
  };
  dnxPaymentAuditEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

function mapAccount(row: Record<string, unknown>): OwnerPaymentAccountRecord {
  return {
    id: String(row.id),
    financialIdentityId: String(row.financialIdentityId),
    provider: "MERCADOPAGO",
    environment: row.environment as FinancialEnvironment,
    providerUserId: (row.providerUserId as string | null) ?? null,
    credentialReference: (row.credentialReference as string | null) ?? null,
    originApp: (row.originApp as string | null) ?? null,
    externalReference: (row.externalReference as string | null) ?? null,
    tokenFingerprint: (row.tokenFingerprint as string | null) ?? null,
    capabilities: (row.capabilities as OwnerPaymentAccountRecord["capabilities"]) ?? [],
    status: row.status as OwnerPaymentAccountRecord["status"],
    connectedAt: (row.connectedAt as Date | null) ?? null,
    verifiedAt: (row.connectedAt as Date | null) ?? null,
    lastHealthCheckAt: (row.updatedAt as Date | null) ?? null,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

/**
 * Prisma-backed store for owner OAuth. Requires migration
 * `20260723120000_dnx_clickaton_mp_oauth_state` applied on the target DB.
 */
export function createPrismaOwnerOAuthStore(
  prisma: PrismaClient | PrismaLike,
): OwnerOAuthStore {
  const db = prisma as PrismaLike;
  return {
    async saveState(state) {
      return db.dnxMercadoPagoOAuthState.create({
        data: {
          id: state.id,
          stateHash: state.stateHash,
          userId: state.userId,
          financialIdentityId: state.financialIdentityId,
          productKey: state.productKey,
          purpose: state.purpose,
          environment: state.environment,
          redirectUri: state.redirectUri,
          codeChallenge: state.codeChallenge,
          codeVerifierCiphertext: state.codeVerifierCiphertext,
          codeVerifierNonce: state.codeVerifierNonce,
          codeVerifierAuthTag: state.codeVerifierAuthTag,
          expiresAt: state.expiresAt,
          usedAt: state.usedAt,
          createdAt: state.createdAt,
        },
      }) as Promise<OwnerOAuthStateRecord>;
    },
    async getStateByHash(stateHash) {
      return db.dnxMercadoPagoOAuthState.findUnique({ where: { stateHash } });
    },
    async markStateUsed(id, at = new Date()) {
      await db.dnxMercadoPagoOAuthState.update({
        where: { id },
        data: { usedAt: at },
      });
    },
    async getOrCreateOwnerIdentity(input) {
      const existing = await db.dnxFinancialIdentity.findFirst({
        where: {
          organizationRef: input.organizationRef ?? CLICKATON_MP_OWNER_ORG_REF,
          status: "ACTIVE",
        },
      });
      if (existing) return existing;
      return db.dnxFinancialIdentity.create({
        data: {
          subjectType: "ORGANIZATION",
          ownerUserId: input.ownerUserId,
          organizationRef: input.organizationRef,
          legalName: input.legalName,
          countryCode: input.countryCode ?? "AR",
          status: "ACTIVE",
          isPrimary: false,
        },
      });
    },
    async findPaymentAccountByProviderUser(input) {
      const row = await db.dnxPaymentAccount.findFirst({
        where: {
          provider: "MERCADOPAGO",
          environment: input.environment,
          providerUserId: input.providerUserId,
          status: { in: ["PENDING", "ACTIVE", "NEEDS_REAUTH"] },
        },
      });
      return row ? mapAccount(row as unknown as Record<string, unknown>) : null;
    },
    async findOwnerPaymentAccount(input) {
      const row = await db.dnxPaymentAccount.findFirst({
        where: {
          financialIdentityId: input.financialIdentityId,
          environment: input.environment,
          originApp: "clickaton",
          externalReference: CLICKATON_MP_OWNER_DEDICATED_MARKER,
        },
        orderBy: { updatedAt: "desc" },
      });
      return row ? mapAccount(row as unknown as Record<string, unknown>) : null;
    },
    async upsertOwnerPaymentAccount(account) {
      const existing = await db.dnxPaymentAccount.findFirst({
        where: { id: account.id },
      });
      if (existing) {
        const updated = await db.dnxPaymentAccount.update({
          where: { id: account.id },
          data: {
            providerUserId: account.providerUserId,
            credentialReference: account.credentialReference,
            originApp: account.originApp,
            externalReference: account.externalReference,
            tokenFingerprint: account.tokenFingerprint,
            capabilities: account.capabilities,
            status: account.status,
            connectedAt: account.connectedAt,
            isPrimary: true,
          },
        });
        return mapAccount(updated as unknown as Record<string, unknown>);
      }
      const created = await db.dnxPaymentAccount.create({
        data: {
          id: account.id,
          financialIdentityId: account.financialIdentityId,
          provider: "MERCADOPAGO",
          environment: account.environment,
          providerUserId: account.providerUserId,
          credentialReference: account.credentialReference,
          originApp: account.originApp,
          externalReference: account.externalReference,
          tokenFingerprint: account.tokenFingerprint,
          capabilities: account.capabilities,
          status: account.status,
          connectedAt: account.connectedAt,
          isPrimary: true,
        },
      });
      return mapAccount(created as unknown as Record<string, unknown>);
    },
    async appendAudit(event: OwnerOAuthAuditEvent) {
      await db.dnxPaymentAuditEvent.create({
        data: {
          actorType: "SYSTEM",
          actorReference: event.actorUserId != null ? `user:${event.actorUserId}` : null,
          action: event.action,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          provider: "MERCADOPAGO",
          result: event.result === "SUCCEEDED" ? "SUCCEEDED" : "FAILED",
          errorCode: event.errorCode ?? null,
          metadata: event.metadata ?? undefined,
          createdAt: event.createdAt,
        },
      });
    },
    async listAudit() {
      return [];
    },
  };
}
