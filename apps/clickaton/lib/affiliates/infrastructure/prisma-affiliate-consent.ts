import { prisma } from "@repo/db";
import {
  MercadoPagoSplitConsentAdapter,
  createMercadoPagoProviderConfig,
} from "@repo/payments";

import {
  DNX_COLLECTOR_PAYMENT_ACCOUNT_ID,
  type AffiliateConsentProviderPort,
  type AffiliateConsentRepository,
} from "./split-consent";

/**
 * `DnxSplitConsent` usa `PRODUCTION`/`SANDBOX`; `DnxPaymentAccount` usa `PROD`/`TEST`.
 * Son enums distintos del esquema.
 */
const CONSENT_PROVIDER = "MERCADOPAGO" as const;
const CONSENT_ENV = "PRODUCTION" as const;

export function createPrismaAffiliateConsentRepository(): AffiliateConsentRepository {
  return {
    async findAffiliate(affiliateId) {
      return prisma.clickatonAffiliate.findUnique({
        where: { id: affiliateId },
        select: {
          id: true,
          userId: true,
          displayName: true,
          mpSellerEmail: true,
          paymentRecipientId: true,
          consentReceiverId: true,
          consentStatus: true,
          consentInviteUrl: true,
          isActive: true,
        },
      });
    },

    async ensurePaymentRecipient(affiliate) {
      if (affiliate.paymentRecipientId) {
        const existing = await prisma.dnxPaymentRecipient.findUnique({
          where: { id: affiliate.paymentRecipientId },
          select: { id: true },
        });
        if (existing) return existing.id;
      }
      const created = await prisma.dnxPaymentRecipient.create({
        data: {
          userId: affiliate.userId,
          recipientType: "AFFILIATE",
          displayReference: `clickaton-affiliate:${affiliate.id}`,
        },
        select: { id: true },
      });
      return created.id;
    },

    async updateAffiliateConsent(affiliateId, data) {
      await prisma.clickatonAffiliate.update({
        where: { id: affiliateId },
        data,
      });
    },

    async upsertSplitConsent(row) {
      await prisma.dnxSplitConsent.upsert({
        where: {
          provider_environment_providerReceiverId: {
            provider: CONSENT_PROVIDER,
            environment: CONSENT_ENV,
            providerReceiverId: row.providerReceiverId,
          },
        },
        update: {
          recipientId: row.recipientId,
          status: row.status,
          invitationReference: row.invitationReference,
          lastCheckedAt: row.checkedAt,
          providerUpdatedAt: row.checkedAt,
        },
        create: {
          provider: CONSENT_PROVIDER,
          environment: CONSENT_ENV,
          providerReceiverId: row.providerReceiverId,
          primaryProviderAccountReference: row.primaryProviderAccountReference,
          recipientId: row.recipientId,
          status: row.status,
          invitationReference: row.invitationReference,
          source: "APPLICATION",
          lastCheckedAt: row.checkedAt,
          providerCreatedAt: row.checkedAt,
          providerUpdatedAt: row.checkedAt,
        },
      });
    },

    async findSplitConsent(providerReceiverId) {
      return prisma.dnxSplitConsent.findUnique({
        where: {
          provider_environment_providerReceiverId: {
            provider: CONSENT_PROVIDER,
            environment: CONSENT_ENV,
            providerReceiverId,
          },
        },
        select: { status: true },
      });
    },
  };
}

/**
 * Adaptador de MP en producción con el token de la cuenta cobradora DNX (la
 * invitación la manda quien cobra, no el fotógrafo). El envío además exige
 * `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED`; las consultas no.
 */
export async function createProductionAffiliateConsentProvider(): Promise<
  { ok: true; provider: AffiliateConsentProviderPort } | { ok: false; error: string }
> {
  const { resolveCollectorAccessTokenFromPaymentAccount } = await import(
    "@/lib/admin/edition-finance/infrastructure/resolve-collector-token"
  );
  const resolved = await resolveCollectorAccessTokenFromPaymentAccount(
    DNX_COLLECTOR_PAYMENT_ACCOUNT_ID,
  );
  if (!resolved.ok) {
    console.error("[clickaton][afiliados] sin token de la cuenta cobradora", {
      code: resolved.code,
    });
    return { ok: false, error: "No pudimos usar la cuenta cobradora de Mercado Pago." };
  }
  const provider = new MercadoPagoSplitConsentAdapter({
    config: createMercadoPagoProviderConfig({
      accessToken: resolved.accessToken,
      environment: "production",
    }),
  });
  return { ok: true, provider };
}
