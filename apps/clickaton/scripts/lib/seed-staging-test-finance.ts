/**
 * Bootstrap idempotente de distribución ACTIVE + PaymentAccount TEST
 * para checkout Mercado Pago TEST en Staging (ep-round-fog).
 * Nunca imprime tokens.
 */
import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import { CredentialVault } from "@repo/payments/credential-vault";
import { createPrismaCredentialStore } from "@repo/payments/infrastructure/prisma";
import {
  ARGENTINA_2026_FEE_POLICY,
  CLICKATON_PRODUCT_KEY,
  DEFAULT_ROUNDING_POLICY,
  EDITION_SCOPE_TYPE,
  PERCENTAGE_BPS_TOTAL,
} from "../../lib/admin/edition-finance/constants";

export type StagingTestFinanceResult = {
  editionId: string;
  agreementId: string;
  versionId: string;
  paymentAccountId: string;
  financialIdentityId: string;
  actorUserId: number;
  providerUserId: string | null;
};

async function ensureActorUser(): Promise<{ id: number; email: string }> {
  const email = "admin.staging@clf.dnx.test";
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email,
      name: "Clickatón Staging Admin",
      role: "ADMIN",
    },
    select: { id: true, email: true },
  });
}

async function fetchTestSellerId(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { id?: unknown };
  return j.id != null ? String(j.id) : null;
}

/**
 * Asegura acuerdo ACTIVE + versión PUBLISHED 100% + cuenta MP TEST vaulted
 * para la edición indicada. Idempotente por productKey/scope.
 */
export async function ensureStagingTestEditionFinance(
  editionId: string,
): Promise<StagingTestFinanceResult> {
  const accessToken = process.env.MERCADOPAGO_TEST_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error("missing_env:MERCADOPAGO_TEST_ACCESS_TOKEN");
  }
  if (
    !process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST?.trim() &&
    !process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY?.trim()
  ) {
    throw new Error("missing_env:DNX_FINANCIAL_CREDENTIAL_MASTER_KEY");
  }

  const actor = await ensureActorUser();
  const providerUserId = await fetchTestSellerId(accessToken);

  let identity = await prisma.dnxFinancialIdentity.findFirst({
    where: { ownerUserId: actor.id, subjectType: "PERSON" },
  });
  if (!identity) {
    identity = await prisma.dnxFinancialIdentity.create({
      data: {
        subjectType: "PERSON",
        ownerUserId: actor.id,
        isPrimary: true,
        legalName: "Clickatón Staging TEST Collector",
        countryCode: "AR",
        status: "ACTIVE",
      },
    });
  } else if (identity.status !== "ACTIVE") {
    identity = await prisma.dnxFinancialIdentity.update({
      where: { id: identity.id },
      data: { status: "ACTIVE" },
    });
  }

  const vault = new CredentialVault(
    createPrismaCredentialStore(prisma as never),
  );
  const tokenFingerprint = createHash("sha256")
    .update(accessToken)
    .digest("hex")
    .slice(0, 32);

  let account = await prisma.dnxPaymentAccount.findFirst({
    where: {
      financialIdentityId: identity.id,
      provider: "MERCADOPAGO",
      environment: "TEST",
      status: "ACTIVE",
    },
  });

  if (!account?.credentialReference) {
    const credential = await vault.encryptMercadoPagoCredential({
      environment: "TEST",
      payload: {
        accessToken,
        refreshToken: null,
        providerUserId: providerUserId ?? "test_seller",
        connectedAt: new Date().toISOString(),
        origin: "clickaton_owner_oauth",
        scopes: null,
      },
    });
    if (account) {
      account = await prisma.dnxPaymentAccount.update({
        where: { id: account.id },
        data: {
          credentialReference: credential.id,
          providerUserId,
          tokenFingerprint,
          capabilities: ["COLLECTOR"],
          isPrimary: true,
          status: "ACTIVE",
          connectedAt: new Date(),
          originApp: "clickaton",
        },
      });
    } else {
      account = await prisma.dnxPaymentAccount.create({
        data: {
          financialIdentityId: identity.id,
          provider: "MERCADOPAGO",
          environment: "TEST",
          providerUserId,
          credentialReference: credential.id,
          tokenFingerprint,
          capabilities: ["COLLECTOR"],
          isPrimary: true,
          status: "ACTIVE",
          connectedAt: new Date(),
          originApp: "clickaton",
        },
      });
    }
  }

  let agreement = await prisma.dnxEconomicAgreement.findUnique({
    where: {
      productKey_scopeType_scopeId: {
        productKey: CLICKATON_PRODUCT_KEY,
        scopeType: EDITION_SCOPE_TYPE,
        scopeId: editionId,
      },
    },
  });

  if (!agreement) {
    agreement = await prisma.dnxEconomicAgreement.create({
      data: {
        productKey: CLICKATON_PRODUCT_KEY,
        scopeType: EDITION_SCOPE_TYPE,
        scopeId: editionId,
        name: `Staging TEST distribution ${editionId.slice(0, 10)}`,
        countryCode: "AR",
        currency: "ARS",
        status: "DRAFT",
        createdByUserId: actor.id,
      },
    });
  }

  let version =
    (agreement.currentVersionId
      ? await prisma.dnxDistributionVersion.findUnique({
          where: { id: agreement.currentVersionId },
        })
      : null) ??
    (await prisma.dnxDistributionVersion.findFirst({
      where: { agreementId: agreement.id },
      orderBy: { versionNumber: "desc" },
    }));

  if (!version) {
    version = await prisma.dnxDistributionVersion.create({
      data: {
        agreementId: agreement.id,
        versionNumber: 1,
        status: "DRAFT",
        roundingPolicy: DEFAULT_ROUNDING_POLICY,
        feePolicy: ARGENTINA_2026_FEE_POLICY,
      },
    });
  }

  const participant = await prisma.dnxAgreementParticipant.upsert({
    where: {
      agreementId_financialIdentityId: {
        agreementId: agreement.id,
        financialIdentityId: identity.id,
      },
    },
    create: {
      agreementId: agreement.id,
      financialIdentityId: identity.id,
      paymentAccountId: account.id,
      roleLabel: "ORGANIZER",
      status: "ACCEPTED",
      invitedByUserId: actor.id,
      acceptedAt: new Date(),
    },
    update: {
      paymentAccountId: account.id,
      status: "ACCEPTED",
    },
  });

  const existingRule = await prisma.dnxDistributionRule.findFirst({
    where: {
      distributionVersionId: version.id,
      agreementParticipantId: participant.id,
    },
  });
  if (!existingRule) {
    await prisma.dnxDistributionRule.create({
      data: {
        distributionVersionId: version.id,
        agreementParticipantId: participant.id,
        kind: "PERCENTAGE",
        value: BigInt(PERCENTAGE_BPS_TOTAL),
        priority: 10,
      },
    });
  }

  if (version.status !== "PUBLISHED" || agreement.status !== "ACTIVE") {
    await prisma.$transaction(async (tx) => {
      await tx.dnxDistributionVersion.updateMany({
        where: { agreementId: agreement!.id, status: "PUBLISHED" },
        data: { status: "SUPERSEDED" },
      });
      await tx.dnxDistributionVersion.update({
        where: { id: version!.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedByUserId: actor.id,
        },
      });
      await tx.dnxEconomicAgreement.update({
        where: { id: agreement!.id },
        data: {
          status: "ACTIVE",
          currentVersionId: version!.id,
        },
      });
    });
  }

  await prisma.clickatonEdition.update({
    where: { id: editionId },
    data: {
      paymentBeneficiaryConfig: {
        agreementId: agreement.id,
        productKey: CLICKATON_PRODUCT_KEY,
        scopeType: EDITION_SCOPE_TYPE,
        policy: "edition_scoped_dnx",
        beneficiaryHint: "staging_test_collector_100",
      },
    },
  });

  return {
    editionId,
    agreementId: agreement.id,
    versionId: version.id,
    paymentAccountId: account.id,
    financialIdentityId: identity.id,
    actorUserId: actor.id,
    providerUserId,
  };
}
