/**
 * 10G.5 — Create ONE clean registration (Terms v2) + LIVE checkout URL.
 * Does NOT pay. Stops for human Mercado Pago step.
 *
 * Requires:
 *   CONFIRM_LIVE_E2E=1
 *   DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED=true
 *   registrationEnabled briefly open (ops-10g1-registration-window)
 *   CLICKATON_PUBLIC_URL=https://maratonfotografica.com
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import { createPublicRegistrationService } from "../lib/public-registration/application/public-registration-service";
import { createPrismaPublicRegistrationRepository } from "../lib/public-registration/infrastructure/prisma-public-registration-repository";
import { signRegistrationAccessToken } from "../lib/public-registration/domain/access-token";
import {
  getCheckoutServiceReady,
  setCheckoutServiceForTests,
} from "../lib/checkout/actions/runtime";
import { resolveCollectorAccessTokenFromPaymentAccount } from "../lib/admin/edition-finance/infrastructure/resolve-collector-token";
import { CLICKATON_TERMS_VERSION } from "../config/editions/argentina-2026";
import {
  isClickatonLivePaymentsEnabled,
  isClickatonProductionRuntime,
  resolveClickatonPaymentsProviderModeControlled,
} from "@repo/payments/next";

const EXPECTED_TERMS = "CLICKATON_TERMS_2026_09_19_v2";
const EXPECTED_PROVIDER_USER = "97484805";
const EXPECTED_RECIPIENT = "dnxfotografia@gmail.com";
const CANONICAL_PA = "pa_ba733fa7a35f4326";

function maskId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 10) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

async function main() {
  if (process.env.CONFIRM_LIVE_E2E !== "1") {
    throw new Error("Set CONFIRM_LIVE_E2E=1");
  }
  if (CLICKATON_TERMS_VERSION !== EXPECTED_TERMS) {
    throw new Error(`SCHEDULE V2 REQUIRED BEFORE LIVE E2E: terms=${CLICKATON_TERMS_VERSION}`);
  }
  const publicBaseUrl = (process.env.CLICKATON_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!/maratonfotografica\.com$/i.test(new URL(publicBaseUrl).host)) {
    throw new Error("CLICKATON_PUBLIC_URL must be Production maratonfotografica.com");
  }
  if (!isClickatonProductionRuntime()) {
    throw new Error("requires_production_runtime");
  }
  if (!isClickatonLivePaymentsEnabled()) {
    throw new Error("requires_LIVE_flag");
  }
  const mode = resolveClickatonPaymentsProviderModeControlled(
    process.env.CLICKATON_DNX_PAYMENTS_PROVIDER,
  );
  if (mode !== "mercado_pago_production") {
    throw new Error(`provider_not_live:${mode}`);
  }

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: "clickaton-argentina-2026" },
    include: {
      ticketTypes: { where: { code: "GENERAL", isActive: true }, take: 1 },
      pricePhases: {
        where: { isActive: true },
        orderBy: { priority: "asc" },
        include: {
          includedItems: {
            where: { isIncluded: true },
            include: {
              product: {
                include: { variants: { where: { isActive: true }, take: 12 } },
              },
            },
          },
        },
      },
    },
  });
  if (!edition?.isPublished || !edition.registrationEnabled) {
    throw new Error("ar2026_not_open_for_e2e");
  }
  if (edition.status === "DRAFT") throw new Error("edition_still_DRAFT");

  const rulesConfig = (edition.rulesConfig ?? {}) as { termsVersion?: string };
  if (rulesConfig.termsVersion !== EXPECTED_TERMS) {
    throw new Error(`SCHEDULE V2 REQUIRED BEFORE LIVE E2E: dbTerms=${rulesConfig.termsVersion}`);
  }

  const now = Date.now();
  const phase = edition.pricePhases.find(
    (p) => p.startsAt.getTime() <= now && p.endsAt.getTime() >= now,
  );
  if (!phase || phase.amount !== 2_500_000) {
    throw new Error(
      `unexpected_phase_amount:${phase?.amount ?? "none"} expected 2500000`,
    );
  }
  const ticket = edition.ticketTypes[0];
  if (!ticket) throw new Error("missing_general_ticket");

  const shirt = phase.includedItems.find(
    (i) => i.product.code === "REMERA_CLICKATON" || i.product.code === "REMERA-CLICKATON",
  );
  const variant =
    shirt?.product.variants.find((v) => v.sizeCode === "M" || v.code?.includes("M")) ??
    shirt?.product.variants[0];
  if (!shirt || !variant) throw new Error("missing_shirt_variant");

  const agr = await prisma.dnxEconomicAgreement.findFirst({
    where: { scopeId: edition.id, status: "ACTIVE" },
    include: {
      currentVersion: {
        include: {
          rules: {
            include: {
              agreementParticipant: {
                include: {
                  financialIdentity: { select: { ownerUserId: true } },
                  paymentAccount: {
                    select: { id: true, providerUserId: true, environment: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  const rules = agr?.currentVersion?.rules ?? [];
  const sumBps = rules.reduce((s, r) => s + Number(r.value), 0);
  const primary = rules.find((r) => Number(r.value) === 10000) ?? rules[0];
  const ownerUid = primary?.agreementParticipant.financialIdentity.ownerUserId;
  const recipientUser = ownerUid
    ? await prisma.user.findUnique({ where: { id: ownerUid }, select: { email: true } })
    : null;
  const pa = primary?.agreementParticipant.paymentAccount;
  if (
    sumBps !== 10000 ||
    recipientUser?.email?.toLowerCase() !== EXPECTED_RECIPIENT ||
    pa?.id !== CANONICAL_PA ||
    pa?.providerUserId !== EXPECTED_PROVIDER_USER ||
    pa?.environment !== "PROD"
  ) {
    throw new Error(
      `pre_checkout_finance_mismatch recipient=${recipientUser?.email} alloc=${sumBps} pa=${pa?.id} provider=${pa?.providerUserId}`,
    );
  }

  const suffix = randomBytes(3).toString("hex");
  const buyerEmail =
    process.env.LIVE_E2E_BUYER_EMAIL?.trim().toLowerCase() ||
    `e2e.live.10g5.${suffix}@dnxsuite.com`;

  const assetId = `asset_10g5_${suffix}`;
  await prisma.dnxMediaAsset.create({
    data: {
      id: assetId,
      platform: "CLICKATON",
      ownerType: "GUEST_UPLOAD",
      ownerId: `guest_10g5_${suffix}`,
      kind: "PROFILE_SQUARE",
      storageBackend: "LOCAL_TEST",
      storageKey: `clickaton/10g5/${suffix}.jpg`,
      mimeType: "image/jpeg",
      bytes: 1024,
      contentHash: createHash("sha256").update(suffix).digest("hex").slice(0, 32),
      width: 400,
      height: 400,
    },
  });

  const publicRepo = createPrismaPublicRegistrationRepository();
  const pub = createPublicRegistrationService({ repo: publicRepo });
  const summary = await pub.createRegistration({
    editionSlug: edition.slug,
    venueId: null,
    ticketTypeId: ticket.id,
    variantChoices: [{ productId: shirt.productId, productVariantId: variant.id }],
    participant: {
      firstName: "E2E",
      lastName: "Live10G5",
      email: buyerEmail,
      phone: "3415550105",
      documentNumber: `31${suffix}`.slice(0, 8),
      city: "Rosario",
      province: "Santa Fe",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    imageUsageConsent: true,
    socialPublicationConsent: true,
    identifiablePersonsConsent: true,
    promotionalLicenseConsent: true,
    termsVersion: CLICKATON_TERMS_VERSION,
    profilePhotoAssetId: assetId,
    instagramHandle: `e2e_live_10g5_${suffix}`,
    idempotencyKey: `10g5-live-${suffix}-${randomUUID().slice(0, 8)}`,
  });

  const regBefore = await prisma.clickatonRegistration.findUnique({
    where: { id: summary.registrationId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      currency: true,
      termsVersion: true,
      termsAcceptedAt: true,
    },
  });
  if (!regBefore || regBefore.totalAmount !== 2_500_000) {
    throw new Error(`stop_amount:${regBefore?.totalAmount}`);
  }
  if (regBefore.termsVersion !== EXPECTED_TERMS || !regBefore.termsAcceptedAt) {
    throw new Error(
      `SCHEDULE V2 REQUIRED BEFORE LIVE E2E: persisted terms=${regBefore.termsVersion}`,
    );
  }

  const projected = {
    amountArs: 25_000,
    recipient: EXPECTED_RECIPIENT,
    allocationPercent: 100,
    collectorMpProviderUserId: EXPECTED_PROVIDER_USER,
    environment: "PROD",
    provider: "mercado_pago_production",
    termsVersion: regBefore.termsVersion,
    sizeCode: variant.sizeCode ?? variant.code,
    tammyPercent: 0,
    splitToOtherAccount: false,
  };

  const accessTok =
    summary.accessToken ||
    signRegistrationAccessToken({
      registrationId: summary.registrationId,
      editionSlug: edition.slug,
      expiresAtMs: Date.now() + 45 * 60_000,
    });

  const collectorTok = await resolveCollectorAccessTokenFromPaymentAccount(CANONICAL_PA);
  if (!collectorTok.ok) {
    throw new Error(`collector_vault:${collectorTok.code}:${collectorTok.message}`);
  }
  process.env.MERCADOPAGO_LIVE_ACCESS_TOKEN = collectorTok.accessToken;
  setCheckoutServiceForTests(null);

  const checkout = await getCheckoutServiceReady();
  const redirect = await checkout.createCheckout({
    registrationId: summary.registrationId,
    editionSlug: edition.slug,
    accessToken: accessTok,
    publicBaseUrl,
  });

  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: summary.registrationId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      currency: true,
      termsVersion: true,
      termsAcceptedAt: true,
      paymentOrderId: true,
    },
  });

  const order = reg?.paymentOrderId
    ? await prisma.dnxPaymentOrder.findUnique({
        where: { id: reg.paymentOrderId },
        select: {
          id: true,
          status: true,
          amountMinor: true,
          currency: true,
          environment: true,
          provider: true,
          paymentIntent: { select: { externalReference: true } },
        },
      })
    : null;

  const out = {
    ok: true,
    stage: "10G.5",
    verdict: "CONTROLLED LIVE PAYMENT HUMAN STEP REQUIRED",
    operator: {
      checkoutUrl: redirect.checkoutUrl,
      buyerEmail,
      amountPesos: 25_000,
      currency: "ARS",
      editionSlug: edition.slug,
      termsVersion: reg?.termsVersion,
      sizeCode: projected.sizeCode,
    },
    projectedBeforePreference: projected,
    ids: {
      registrationId: summary.registrationId,
      registrationIdMasked: maskId(summary.registrationId),
      paymentOrderId: redirect.paymentOrderId ?? reg?.paymentOrderId ?? null,
      paymentOrderIdMasked: maskId(
        redirect.paymentOrderId ?? reg?.paymentOrderId ?? null,
      ),
      accessTokenPresent: Boolean(accessTok),
    },
    registration: {
      status: reg?.status,
      paymentStatus: reg?.paymentStatus,
      termsAcceptedAt: reg?.termsAcceptedAt,
      totalAmount: reg?.totalAmount,
    },
    order: order
      ? {
          idMasked: maskId(order.id),
          status: order.status,
          amountMinor: Number(order.amountMinor),
          currency: order.currency,
          environment: order.environment,
          provider: order.provider,
          externalReferenceMasked: maskId(
            order.paymentIntent?.externalReference ?? null,
          ),
        }
      : null,
    stopReminders: [
      "Do NOT automate card entry or 2FA",
      "Complete ONE LIVE payment for 25000 ARS only",
      "Reply PAGO HECHO after approved payment",
      "Keep registrationEnabled=false for public until human GO",
    ],
  };

  writeFileSync("/tmp/clickaton-10g5-live-checkout.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
