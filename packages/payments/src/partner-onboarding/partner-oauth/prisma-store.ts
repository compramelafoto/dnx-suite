import type { PrismaClient } from "@prisma/client";
import {
  CLICKATON_MP_OWNER_DEDICATED_MARKER,
  CLICKATON_MP_OWNER_ORG_REF,
} from "../owner-oauth/config.js";
import { createPrismaOwnerOAuthStore } from "../owner-oauth/prisma-store.js";
import type { OwnerPaymentAccountRecord } from "../owner-oauth/types.js";
import {
  PARTNER_MP_EXTERNAL_REF,
  PARTNER_MP_ORIGIN_APP,
} from "./config.js";
import { snapshotFromAccount } from "./invariants.js";
import {
  adaptOwnerStoreToPartnerStore,
  type PartnerOAuthStore,
} from "./store.js";
import type {
  PartnerFinancialIdentityRecord,
  PartnerPaymentAccountRecord,
} from "./types.js";

type PrismaLike = {
  dnxFinancialIdentity: {
    findFirst(args: unknown): Promise<PartnerFinancialIdentityRecord | null>;
    create(args: {
      data: Record<string, unknown>;
    }): Promise<PartnerFinancialIdentityRecord>;
  };
  dnxPaymentAccount: {
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
  };
  dnxAgreementParticipant: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
  };
};

function mapAccount(row: Record<string, unknown>): PartnerPaymentAccountRecord {
  return {
    id: String(row.id),
    financialIdentityId: String(row.financialIdentityId),
    provider: "MERCADOPAGO",
    environment: row.environment as PartnerPaymentAccountRecord["environment"],
    providerUserId: (row.providerUserId as string | null) ?? null,
    credentialReference: (row.credentialReference as string | null) ?? null,
    originApp: (row.originApp as string | null) ?? null,
    externalReference: (row.externalReference as string | null) ?? null,
    tokenFingerprint: (row.tokenFingerprint as string | null) ?? null,
    capabilities:
      (row.capabilities as PartnerPaymentAccountRecord["capabilities"]) ?? [],
    status: row.status as PartnerPaymentAccountRecord["status"],
    connectedAt: (row.connectedAt as Date | null) ?? null,
    verifiedAt: (row.connectedAt as Date | null) ?? null,
    lastHealthCheckAt: (row.updatedAt as Date | null) ?? null,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

export function createPrismaPartnerOAuthStore(
  prisma: PrismaClient | PrismaLike,
): PartnerOAuthStore {
  const db = prisma as PrismaLike;
  const ownerStore = createPrismaOwnerOAuthStore(prisma as never);

  return adaptOwnerStoreToPartnerStore(ownerStore, {
    async getOrCreatePersonIdentity(input) {
      const existing = await db.dnxFinancialIdentity.findFirst({
        where: {
          ownerUserId: input.ownerUserId,
          subjectType: "PERSON",
          status: "ACTIVE",
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      if (existing) return existing;
      return db.dnxFinancialIdentity.create({
        data: {
          subjectType: "PERSON",
          ownerUserId: input.ownerUserId,
          isPrimary: true,
          legalName: input.legalName ?? `Partner ${input.ownerUserId}`,
          countryCode: input.countryCode ?? "AR",
          status: "ACTIVE",
        },
      });
    },
    async findPartnerPaymentAccount(input) {
      const tagged = await db.dnxPaymentAccount.findFirst({
        where: {
          financialIdentityId: input.financialIdentityId,
          environment: input.environment,
          originApp: PARTNER_MP_ORIGIN_APP,
          externalReference: PARTNER_MP_EXTERNAL_REF,
        },
        orderBy: { updatedAt: "desc" },
      });
      if (tagged) return mapAccount(tagged);

      const fallback = await db.dnxPaymentAccount.findFirst({
        where: {
          financialIdentityId: input.financialIdentityId,
          environment: input.environment,
          NOT: {
            externalReference: CLICKATON_MP_OWNER_DEDICATED_MARKER,
          },
        },
        orderBy: { updatedAt: "desc" },
      });
      return fallback ? mapAccount(fallback) : null;
    },
    async getOwnerCollectorSnapshot() {
      const identity = await db.dnxFinancialIdentity.findFirst({
        where: {
          organizationRef: CLICKATON_MP_OWNER_ORG_REF,
          status: "ACTIVE",
        },
      });
      if (!identity) return null;
      const row = await db.dnxPaymentAccount.findFirst({
        where: {
          financialIdentityId: identity.id,
          environment: "PROD",
          originApp: "clickaton",
          externalReference: CLICKATON_MP_OWNER_DEDICATED_MARKER,
        },
        orderBy: { updatedAt: "desc" },
      });
      if (!row) return null;
      return snapshotFromAccount(mapAccount(row) as OwnerPaymentAccountRecord);
    },
    async isPaymentAccountReferencedByActiveDistribution(paymentAccountId) {
      const participant = await db.dnxAgreementParticipant.findFirst({
        where: {
          paymentAccountId,
          status: { in: ["ACCEPTED", "ACTIVE"] },
          agreement: {
            status: "ACTIVE",
            currentVersion: { is: { status: "PUBLISHED" } },
          },
        },
      });
      return Boolean(participant);
    },
  });
}
