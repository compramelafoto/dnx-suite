import type { DualReadPorts } from "../../dual-read/types.js";
import type { CredentialVault } from "../../credential-vault/vault.js";
import type { FinancialEnvironment } from "../../financial-identity/types.js";

/** Minimal Prisma surface for dual-read resolution. */
export interface DualReadPrismaDelegates {
  user: {
    findUnique: (args: unknown) => Promise<{
      id: number;
      mpUserId: string | null;
      mpAccessToken: string | null;
      mpRefreshToken: string | null;
      mpConnectedAt: Date | null;
    } | null>;
  };
  lab: {
    findUnique: (args: unknown) => Promise<{
      id: number;
      userId: number | null;
      name: string;
      country: string | null;
      mpUserId: string | null;
      mpAccessToken: string | null;
      mpRefreshToken: string | null;
      mpConnectedAt: Date | null;
    } | null>;
  };
  dnxFinancialIdentity: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };
  dnxPaymentAccount: {
    findFirst: (args: unknown) => Promise<{
      id: string;
      financialIdentityId: string;
      providerUserId: string | null;
      credentialReference: string | null;
      status: string;
    } | null>;
  };
}

export function createPrismaDualReadPorts(input: {
  prisma: DualReadPrismaDelegates;
  vault: CredentialVault;
}): DualReadPorts {
  const { prisma, vault } = input;
  return {
    async loadLegacyUserMp(userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          mpUserId: true,
          mpAccessToken: true,
          mpRefreshToken: true,
          mpConnectedAt: true,
        },
      });
      if (!user) return null;
      return {
        userId: user.id,
        mpUserId: user.mpUserId,
        mpAccessToken: user.mpAccessToken,
        mpRefreshToken: user.mpRefreshToken,
        mpConnectedAt: user.mpConnectedAt,
      };
    },
    async loadLegacyLabMp(labId) {
      const lab = await prisma.lab.findUnique({
        where: { id: labId },
        select: {
          id: true,
          userId: true,
          name: true,
          country: true,
          mpUserId: true,
          mpAccessToken: true,
          mpRefreshToken: true,
          mpConnectedAt: true,
        },
      });
      if (!lab) return null;
      return {
        labId: lab.id,
        ownerUserId: lab.userId,
        name: lab.name,
        country: lab.country,
        mpUserId: lab.mpUserId,
        mpAccessToken: lab.mpAccessToken,
        mpRefreshToken: lab.mpRefreshToken,
        mpConnectedAt: lab.mpConnectedAt,
      };
    },
    async findActivePaymentAccountForUser({ userId, environment, requiredCapability }) {
      const identity = await prisma.dnxFinancialIdentity.findFirst({
        where: {
          ownerUserId: userId,
          subjectType: "PERSON",
          isPrimary: true,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!identity) return null;
      const account = await prisma.dnxPaymentAccount.findFirst({
        where: {
          financialIdentityId: identity.id,
          environment: environment as FinancialEnvironment,
          status: "ACTIVE",
          ...(requiredCapability
            ? { capabilities: { has: requiredCapability } }
            : {}),
        },
        orderBy: { isPrimary: "desc" },
        select: {
          id: true,
          financialIdentityId: true,
          providerUserId: true,
          credentialReference: true,
          status: true,
        },
      });
      if (!account) return null;
      return {
        paymentAccountId: account.id,
        financialIdentityId: account.financialIdentityId,
        providerUserId: account.providerUserId,
        credentialReference: account.credentialReference,
        status: account.status,
      };
    },
    async findActivePaymentAccountForLab({ labId, environment }) {
      const identity = await prisma.dnxFinancialIdentity.findFirst({
        where: {
          organizationRef: `lab:${labId}`,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!identity) return null;
      const account = await prisma.dnxPaymentAccount.findFirst({
        where: {
          financialIdentityId: identity.id,
          environment,
          status: "ACTIVE",
        },
        select: {
          id: true,
          financialIdentityId: true,
          providerUserId: true,
          credentialReference: true,
          status: true,
        },
      });
      if (!account) return null;
      return {
        paymentAccountId: account.id,
        financialIdentityId: account.financialIdentityId,
        providerUserId: account.providerUserId,
        credentialReference: account.credentialReference,
        status: account.status,
      };
    },
    async decryptCredential(credentialReference) {
      const payload = await vault.decryptMercadoPagoCredential(credentialReference);
      return {
        accessToken: payload.accessToken,
        providerUserId: payload.providerUserId,
      };
    },
  };
}
