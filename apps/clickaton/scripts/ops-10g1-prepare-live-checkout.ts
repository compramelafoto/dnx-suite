/**
 * Controlled LIVE E2E: create ONE guest registration + LIVE checkout URL.
 *
 * Safety:
 *   CONFIRM_LIVE_E2E=1
 *   CLICKATON_PUBLIC_URL must be maratonfotografica.com
 *   provider mercado_pago_production + LIVE flag
 *   amount must be 25000
 *
 * Does NOT pay. Operator completes Mercado Pago with real funds.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import { createPublicRegistrationService } from "../lib/public-registration/application/public-registration-service";
import { createPrismaPublicRegistrationRepository } from "../lib/public-registration/infrastructure/prisma-public-registration-repository";
import { signRegistrationAccessToken } from "../lib/public-registration/domain/access-token";
import { getCheckoutService } from "../lib/checkout/actions/runtime";
import { CLICKATON_TERMS_VERSION } from "../config/editions/argentina-2026";
import {
  isClickatonLivePaymentsEnabled,
  isClickatonProductionRuntime,
  resolveClickatonPaymentsProviderModeControlled,
} from "@repo/payments/next";

function maskId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 10) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

async function main() {
  if (process.env.CONFIRM_LIVE_E2E !== "1") {
    throw new Error("Set CONFIRM_LIVE_E2E=1");
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
                include: { variants: { where: { isActive: true }, take: 5 } },
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

  const suffix = randomBytes(3).toString("hex");
  const buyerEmail =
    process.env.LIVE_E2E_BUYER_EMAIL?.trim().toLowerCase() ||
    `e2e.live.10g1.${suffix}@dnxsuite.com`;

  const assetId = `asset_10g1_${suffix}`;
  await prisma.dnxMediaAsset.create({
    data: {
      id: assetId,
      platform: "CLICKATON",
      ownerType: "GUEST_UPLOAD",
      ownerId: `guest_10g1_${suffix}`,
      kind: "PROFILE_SQUARE",
      storageBackend: "LOCAL_TEST",
      storageKey: `clickaton/10g1/${suffix}.jpg`,
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
    variantChoices:
      shirt && variant
        ? [{ productId: shirt.productId, productVariantId: variant.id }]
        : [],
    participant: {
      firstName: "E2E",
      lastName: "LiveControl",
      email: buyerEmail,
      phone: "3415550100",
      documentNumber: `30${suffix}`.slice(0, 8),
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
    instagramHandle: `e2e_live_${suffix}`,
    idempotencyKey: `10g1-live-${suffix}-${randomUUID().slice(0, 8)}`,
  });

  const accessTok =
    summary.accessToken ||
    signRegistrationAccessToken({
      registrationId: summary.registrationId,
      editionSlug: edition.slug,
      expiresAtMs: Date.now() + 45 * 60_000,
    });

  const checkout = getCheckoutService();
  const redirect = await checkout.createCheckout({
    registrationId: summary.registrationId,
    editionSlug: edition.slug,
    accessToken: accessTok,
    publicBaseUrl,
  });
  const checkoutUrl = redirect.checkoutUrl;
  const paymentOrderId = redirect.paymentOrderId ?? null;

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
  if (!reg || reg.totalAmount !== 2_500_000) {
    throw new Error(`stop_amount:${reg?.totalAmount}`);
  }

  const out = {
    ok: true,
    operator: {
      checkoutUrl,
      buyerEmail,
      amountPesos: 25_000,
      currency: "ARS",
      editionSlug: edition.slug,
      termsVersion: reg.termsVersion,
    },
    ids: {
      registrationId: summary.registrationId,
      registrationIdMasked: maskId(summary.registrationId),
      paymentOrderId,
      paymentOrderIdMasked: maskId(paymentOrderId),
      accessTokenPresent: Boolean(accessTok),
    },
    registration: {
      status: reg.status,
      paymentStatus: reg.paymentStatus,
      termsAcceptedAt: reg.termsAcceptedAt,
    },
    stopReminders: [
      "Complete ONE LIVE payment for 25000 ARS only",
      "Recipient must be dnxfotografia@gmail.com / 100%",
      "Close registrationEnabled after checkout URL is secured if not already",
    ],
  };

  writeFileSync("/tmp/clickaton-10g1-live-checkout.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
