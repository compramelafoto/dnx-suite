/**
 * 10G.7 — ONE clean Production registration + LIVE checkout.
 * Does NOT pay. Stops for external payer (≠ collector 97484805).
 *
 * Requires:
 *   CONFIRM_LIVE_E2E=1
 *   DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED=true (local process + ideally Vercel)
 *   registrationEnabled briefly open
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
    throw new Error(`terms_not_v2:${CLICKATON_TERMS_VERSION}`);
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
                include: {
                  variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!edition?.isPublished || !edition.registrationEnabled) {
    throw new Error("ar2026_not_open_for_controlled_window");
  }
  if (edition.status === "DRAFT") throw new Error("edition_still_DRAFT");

  const rulesConfig = (edition.rulesConfig ?? {}) as { termsVersion?: string };
  if (rulesConfig.termsVersion !== EXPECTED_TERMS) {
    throw new Error(`db_terms_not_v2:${rulesConfig.termsVersion}`);
  }

  const now = Date.now();
  const phase = edition.pricePhases.find(
    (p) => p.startsAt.getTime() <= now && p.endsAt.getTime() >= now,
  );
  if (!phase || Number(phase.amount) !== 2_500_000) {
    throw new Error(`unexpected_phase_amount:${phase?.amount ?? "none"}`);
  }
  const ticket = edition.ticketTypes[0];
  if (!ticket) throw new Error("missing_general_ticket");

  const shirt = phase.includedItems.find(
    (i) => i.product.code === "REMERA_CLICKATON" || i.product.code === "REMERA-CLICKATON",
  );
  const variant =
    shirt?.product.variants.find((v) => v.code === "M" || v.name === "M") ?? null;
  if (!shirt || !variant) throw new Error("missing_shirt_M");

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
    `e2e.live.10g7.${suffix}@dnxsuite.com`;

  const assetId = `asset_10g7_${suffix}`;
  await prisma.dnxMediaAsset.create({
    data: {
      id: assetId,
      platform: "CLICKATON",
      ownerType: "GUEST_UPLOAD",
      ownerId: `guest_10g7_${suffix}`,
      kind: "PROFILE_SQUARE",
      storageBackend: "LOCAL_TEST",
      storageKey: `clickaton/10g7/${suffix}.jpg`,
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
      lastName: "Live10G7",
      email: buyerEmail,
      phone: "3415550107",
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
    instagramHandle: `clickaton.live.${suffix}`,
    idempotencyKey: `10g7-live-${suffix}-${randomUUID().slice(0, 8)}`,
  });

  const regBefore = await prisma.clickatonRegistration.findUnique({
    where: { id: summary.registrationId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      termsVersion: true,
      termsAcceptedAt: true,
      instagramHandle: true,
    },
  });
  if (!regBefore || Number(regBefore.totalAmount) !== 2_500_000) {
    throw new Error(`stop_amount:${regBefore?.totalAmount}`);
  }
  if (regBefore.termsVersion !== EXPECTED_TERMS || !regBefore.termsAcceptedAt) {
    throw new Error(`terms_persist_fail:${regBefore.termsVersion}`);
  }

  const projected = {
    amountArs: 25_000,
    recipient: EXPECTED_RECIPIENT,
    allocationPercent: 100,
    collectorMpProviderUserId: EXPECTED_PROVIDER_USER,
    environment: "PROD",
    provider: "mercado_pago_production",
    termsVersion: regBefore.termsVersion,
    sizeCode: variant.code,
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
      termsVersion: true,
      termsAcceptedAt: true,
      paymentOrderId: true,
      instagramHandle: true,
      items: {
        select: { nameSnapshot: true, variantNameSnapshot: true, skuSnapshot: true },
      },
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

  const allocations = reg?.paymentOrderId
    ? await prisma.dnxPaymentOrderAllocation.findMany({
        where: { paymentOrderId: reg.paymentOrderId },
        select: { role: true, basisPoints: true, chargedAmount: true },
      })
    : [];

  // Preference collector sanity (MP)
  let preferenceCollector: string | number | null = null;
  let preferenceId: string | null = null;
  try {
    const prefMatch = redirect.checkoutUrl.match(/pref_id=([^&]+)/);
    preferenceId = prefMatch?.[1] ?? null;
    if (preferenceId) {
      const prefRes = await fetch(
        `https://api.mercadopago.com/checkout/preferences/${preferenceId}`,
        { headers: { Authorization: `Bearer ${collectorTok.accessToken}` } },
      );
      if (prefRes.ok) {
        const pref = (await prefRes.json()) as {
          collector_id?: number | string;
          items?: Array<{ unit_price?: number }>;
        };
        preferenceCollector = pref.collector_id ?? null;
        const unit = pref.items?.[0]?.unit_price;
        if (unit != null && Number(unit) !== 25_000) {
          throw new Error(`preference_amount_mismatch:${unit}`);
        }
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("preference_amount")) throw e;
    // soft: preference fetch optional
  }

  if (
    preferenceCollector != null &&
    String(preferenceCollector) !== EXPECTED_PROVIDER_USER
  ) {
    throw new Error(`preference_collector_mismatch:${preferenceCollector}`);
  }

  const liveProviders = new Set([
    "mercado_pago_production",
    "MERCADOPAGO_PREFERENCES_LEGACY",
    "MERCADOPAGO",
  ]);
  if (
    !order ||
    Number(order.amountMinor) !== 2_500_000 ||
    order.environment !== "PRODUCTION" ||
    !liveProviders.has(String(order.provider ?? ""))
  ) {
    throw new Error(
      `order_guard_fail status=${order?.status} env=${order?.environment} provider=${order?.provider} amount=${order?.amountMinor}`,
    );
  }
  if (
    allocations.length !== 1 ||
    allocations[0]?.role !== "ORGANIZER" ||
    allocations[0]?.basisPoints !== 10000
  ) {
    throw new Error(`allocation_guard_fail:${JSON.stringify(allocations)}`);
  }

  const out = {
    ok: true,
    stage: "10G.7",
    verdict: "LIVE EXTERNAL PAYER HUMAN STEP REQUIRED",
    operator: {
      checkoutUrl: redirect.checkoutUrl,
      buyerEmail,
      amountPesos: 25_000,
      currency: "ARS",
      editionSlug: edition.slug,
      termsVersion: reg?.termsVersion,
      sizeCode: variant.code,
      instagramHandle: reg?.instagramHandle,
      collector: EXPECTED_PROVIDER_USER,
      recipient: EXPECTED_RECIPIENT,
      allocationPercent: 100,
      preferenceId,
      preferenceCollector: preferenceCollector != null ? String(preferenceCollector) : null,
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
      totalAmount: reg?.totalAmount != null ? Number(reg.totalAmount) : null,
      items: reg?.items,
    },
    order: {
      id: order.id,
      idMasked: maskId(order.id),
      status: order.status,
      amountMinor: Number(order.amountMinor),
      currency: order.currency,
      environment: order.environment,
      provider: order.provider,
      externalReferenceMasked: maskId(order.paymentIntent?.externalReference ?? null),
    },
    allocations: allocations.map((a) => ({
      role: a.role,
      basisPoints: a.basisPoints,
      chargedAmount: Number(a.chargedAmount),
    })),
    stopReminders: [
      "Pagar UNA sola vez con cuenta Mercado Pago DISTINTA del collector 97484805",
      "NO automatizar password/2FA/tarjeta",
      "NO usar self-payment (collector = buyer)",
      "Después del pago: responder PAGO HECHO",
      "Mantener registrationEnabled=false hasta GO humano explícito",
    ],
  };

  writeFileSync("/tmp/clickaton-10g7-live-checkout.json", JSON.stringify(out, null, 2));
  writeFileSync("/tmp/clickaton_10g7_checkout_url.txt", redirect.checkoutUrl);
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
