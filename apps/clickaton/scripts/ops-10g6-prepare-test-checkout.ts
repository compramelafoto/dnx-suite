/**
 * 10G.6 — Staging MP TEST checkout (no Production mutation).
 *
 * Requires smoke env with:
 *   DATABASE_URL → ep-round-fog / staging
 *   CLICKATON_PUBLIC_URL=https://clickaton-staging.vercel.app
 *   CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_test
 *   MERCADOPAGO_TEST_ACCESS_TOKEN + CREDENTIALS_SOURCE=credenciales_de_prueba
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import { createPublicRegistrationService } from "../lib/public-registration/application/public-registration-service";
import { createPrismaPublicRegistrationRepository } from "../lib/public-registration/infrastructure/prisma-public-registration-repository";
import { signRegistrationAccessToken } from "../lib/public-registration/domain/access-token";
import { createCheckoutService } from "../lib/checkout/application/checkout-service";
import { createPrismaCheckoutMutations } from "../lib/checkout/infrastructure/prisma-checkout-mutations";
import { createDurableDnxPaymentsClient } from "../lib/checkout/infrastructure/durable-dnx-payments-client";
import { createCheckoutLogSink } from "../lib/checkout/domain/observability";
import {
  createPrismaDnxPaymentsPersistence,
  createMercadoPagoCheckoutProTestAdapter,
  createMercadoPagoTestClickatonProviderBridge,
  resolveClickatonPaymentsProviderMode,
  type DnxPaymentsPrismaDelegates,
} from "@repo/payments/next";
import { CLICKATON_TERMS_VERSION } from "../config/editions/argentina-2026";
import { ensureStagingTestEditionFinance } from "./lib/seed-staging-test-finance";

const EXPECTED_TERMS = "CLICKATON_TERMS_2026_09_19_v2";

function maskId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 10) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

async function fetchSellerMe(accessToken: string) {
  const res = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`users_me_http_${res.status}`);
  return (await res.json()) as {
    id?: number | string;
    nickname?: string;
    email?: string;
    site_id?: string;
    tags?: string[];
  };
}

async function main() {
  if (CLICKATON_TERMS_VERSION !== EXPECTED_TERMS) {
    throw new Error(`terms_code_not_v2:${CLICKATON_TERMS_VERSION}`);
  }
  const publicBaseUrl = (process.env.CLICKATON_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!publicBaseUrl.includes("clickaton-staging")) {
    throw new Error("requires_clickaton_staging_public_url");
  }
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (/silent-haze|clickaton_production/i.test(dbUrl)) {
    throw new Error("refusing_production_database");
  }
  if (!/round-fog|staging|neondb/i.test(dbUrl)) {
    throw new Error("database_not_recognized_as_staging");
  }
  const mode = resolveClickatonPaymentsProviderMode(
    process.env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual",
  );
  if (mode !== "mercado_pago_test") {
    throw new Error(`requires_mercado_pago_test:${mode}`);
  }
  const accessToken = process.env.MERCADOPAGO_TEST_ACCESS_TOKEN?.trim();
  if (!accessToken) throw new Error("missing_MERCADOPAGO_TEST_ACCESS_TOKEN");

  const seller = await fetchSellerMe(accessToken);
  const sellerEmail = (seller.email || "").toLowerCase();
  const tags = seller.tags || [];
  const sellerIsTest =
    tags.includes("test_user") || sellerEmail.endsWith("@testuser.com");
  if (!sellerIsTest) {
    throw new Error("seller_not_test_user");
  }

  // Ensure edition open for TEST E2E
  const editionRow = await prisma.clickatonEdition.update({
    where: { slug: "clickaton-argentina-2026" },
    data: { registrationEnabled: true, isPublished: true },
    select: { id: true, status: true, registrationEnabled: true, rulesConfig: true },
  });
  const rules = (editionRow.rulesConfig ?? {}) as { termsVersion?: string };
  if (rules.termsVersion && rules.termsVersion !== EXPECTED_TERMS) {
    await prisma.clickatonEdition.update({
      where: { id: editionRow.id },
      data: {
        rulesConfig: {
          ...(typeof editionRow.rulesConfig === "object" &&
          editionRow.rulesConfig &&
          !Array.isArray(editionRow.rulesConfig)
            ? (editionRow.rulesConfig as object)
            : {}),
          termsVersion: EXPECTED_TERMS,
        },
      },
    });
  }

  await ensureStagingTestEditionFinance(editionRow.id);

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionRow.id },
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
  if (!edition) throw new Error("edition_missing");
  const ticket = edition.ticketTypes[0];
  if (!ticket) throw new Error("missing_general_ticket");

  const now = Date.now();
  const phase = edition.pricePhases.find(
    (p) => p.startsAt.getTime() <= now && p.endsAt.getTime() >= now,
  );
  if (!phase || Number(phase.amount) !== 2_500_000) {
    throw new Error(`unexpected_amount:${phase?.amount ?? "none"}`);
  }
  const shirt = phase.includedItems.find(
    (i) =>
      i.product.code === "REMERA-CLICKATON" || i.product.code === "REMERA_CLICKATON",
  );
  const variant =
    shirt?.product.variants.find((v) => v.code === "M" || v.name === "M") ??
    null;
  if (!shirt || !variant) throw new Error("missing_shirt_M");

  const suffix = randomBytes(3).toString("hex");
  const buyerEmail =
    process.env.MERCADOPAGO_TEST_BUYER_EMAIL?.trim().toLowerCase() ||
    `buyer.10g6.${suffix}@testuser.com`;
  if (sellerEmail && buyerEmail === sellerEmail) {
    throw new Error("buyer_must_differ_from_seller");
  }

  const assetId = `asset_10g6_${suffix}`;
  await prisma.dnxMediaAsset.create({
    data: {
      id: assetId,
      platform: "CLICKATON",
      ownerType: "GUEST_UPLOAD",
      ownerId: `guest_10g6_${suffix}`,
      kind: "PROFILE_SQUARE",
      storageBackend: "LOCAL_TEST",
      storageKey: `clickaton/10g6/${suffix}.jpg`,
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
      lastName: "TenG6",
      email: buyerEmail,
      phone: "3415550106",
      documentNumber: `32${suffix}`.slice(0, 8),
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
    instagramHandle: `clickaton.e2e.${suffix}`,
    idempotencyKey: `10g6-test-${suffix}-${randomUUID().slice(0, 8)}`,
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
    },
  });
  if (!reg || reg.totalAmount !== 2_500_000) {
    throw new Error(`bad_amount:${reg?.totalAmount}`);
  }
  if (reg.termsVersion !== EXPECTED_TERMS || !reg.termsAcceptedAt) {
    throw new Error(`terms_not_v2:${reg.termsVersion}`);
  }

  const accessTok =
    summary.accessToken ||
    signRegistrationAccessToken({
      registrationId: summary.registrationId,
      editionSlug: edition.slug,
      expiresAtMs: Date.now() + 45 * 60_000,
    });

  const sourceRaw = process.env.MERCADOPAGO_CREDENTIALS_SOURCE ?? "unknown";
  const credentialsSource =
    sourceRaw === "credenciales_de_prueba"
      ? "credenciales_de_prueba"
      : sourceRaw === "production_panel"
        ? "production_panel"
        : "unknown";
  const adapter = createMercadoPagoCheckoutProTestAdapter({
    accessToken,
    publicKey: process.env.MERCADOPAGO_TEST_PUBLIC_KEY,
    credentialsSource,
  });
  const bridge = createMercadoPagoTestClickatonProviderBridge({ adapter });
  const webhookSecret =
    process.env.DNX_PAYMENTS_WEBHOOK_SECRET?.trim() || "dev-only-webhook-secret";
  const webhookPublic =
    process.env.DNX_PAYMENTS_WEBHOOK_PUBLIC_URL ??
    `${publicBaseUrl}/api/webhooks/dnx-payments`;

  const checkout = createCheckoutService({
    publicRepo,
    payments: createDurableDnxPaymentsClient({
      persistence: createPrismaDnxPaymentsPersistence(
        prisma as unknown as DnxPaymentsPrismaDelegates,
      ),
      webhookSecret,
      checkoutBaseUrl: "https://payments.test/checkout",
      notificationUrl: webhookPublic,
      providerBridge: bridge,
      isTestFixture: true,
    }),
    mutations: createPrismaCheckoutMutations(),
    log: createCheckoutLogSink(),
    publicBaseUrl,
  });

  const redirect = await checkout.createCheckout({
    registrationId: summary.registrationId,
    editionSlug: edition.slug,
    accessToken: accessTok,
    publicBaseUrl,
  });

  let preferenceId: string | null = null;
  try {
    preferenceId = new URL(redirect.checkoutUrl).searchParams.get("pref_id");
  } catch {
    preferenceId = null;
  }

  const out = {
    ok: true,
    stage: "10G.6",
    environment: "STAGING_MP_TEST",
    operator: {
      checkoutUrl: redirect.checkoutUrl,
      buyerEmail,
      sellerNickname: seller.nickname ?? null,
      sellerId: seller.id ?? null,
      amountPesos: 25_000,
      currency: "ARS",
      termsVersion: reg.termsVersion,
      sizeCode: variant.code,
    },
    ids: {
      registrationId: summary.registrationId,
      registrationIdMasked: maskId(summary.registrationId),
      paymentOrderId: redirect.paymentOrderId ?? null,
      paymentOrderIdMasked: maskId(redirect.paymentOrderId ?? null),
      preferenceId,
      preferenceIdMasked: maskId(preferenceId),
      accessTokenPresent: Boolean(accessTok),
    },
    registration: {
      status: reg.status,
      paymentStatus: reg.paymentStatus,
      termsAcceptedAt: reg.termsAcceptedAt,
    },
    guards: {
      sellerIsTest: true,
      buyerDiffersFromSeller: buyerEmail !== sellerEmail,
      databaseStaging: true,
      notProductionLive: true,
    },
  };

  writeFileSync("/tmp/clickaton-10g6-test-checkout.json", JSON.stringify(out, null, 2));
  writeFileSync("/tmp/clickaton_10g6_checkout_url.txt", redirect.checkoutUrl);
  writeFileSync(
    "/tmp/clickaton_10g6_access_token.txt",
    accessTok,
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
