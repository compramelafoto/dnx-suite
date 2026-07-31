/**
 * Prepara inscripción guest AR2026 + checkout MP TEST para pago manual 10C.3.
 * Nunca imprime tokens ni secretos.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import { createPublicRegistrationService } from "../../lib/public-registration/application/public-registration-service";
import { createPrismaPublicRegistrationRepository } from "../../lib/public-registration/infrastructure/prisma-public-registration-repository";
import { signRegistrationAccessToken } from "../../lib/public-registration/domain/access-token";
import { createCheckoutService } from "../../lib/checkout/application/checkout-service";
import { createPrismaCheckoutMutations } from "../../lib/checkout/infrastructure/prisma-checkout-mutations";
import { createDurableDnxPaymentsClient } from "../../lib/checkout/infrastructure/durable-dnx-payments-client";
import { createCheckoutLogSink } from "../../lib/checkout/domain/observability";
import {
  createPrismaDnxPaymentsPersistence,
  createMercadoPagoCheckoutProTestAdapter,
  createMercadoPagoTestClickatonProviderBridge,
  resolveClickatonPaymentsProviderMode,
  type DnxPaymentsPrismaDelegates,
} from "@repo/payments/next";
import { ensureStagingTestEditionFinance } from "./seed-staging-test-finance";

function maskId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 10) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function readEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`missing_env:${name}`);
  return v;
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

async function fetchPreference(accessToken: string, preferenceId: string) {
  const res = await fetch(
    `https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(preferenceId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`preference_http_${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export type ManualCheckoutBundle = {
  ok: boolean;
  blockedReason: string | null;
  operator: {
    checkoutUrl: string;
    buyerEmailHint: string;
    registrationRef: string;
    editionSlug: string;
    amountPesos: number;
    currency: string;
  };
  sellerAudit: Record<string, unknown>;
  ids: {
    registrationId: string;
    paymentOrderId: string | null;
    preferenceId: string | null;
    accessToken: string;
  };
};

export async function prepare10c3ManualCheckout(): Promise<ManualCheckoutBundle> {
  const publicBaseUrl = readEnv("CLICKATON_PUBLIC_URL");
  if (!publicBaseUrl.includes("clickaton-staging")) {
    throw new Error("requires_clickaton_staging_public_url");
  }
  const mode = resolveClickatonPaymentsProviderMode(
    process.env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual",
  );
  if (mode !== "mercado_pago_test") {
    throw new Error("requires_mercado_pago_test");
  }

  const accessToken = readEnv("MERCADOPAGO_TEST_ACCESS_TOKEN");
  const seller = await fetchSellerMe(accessToken);
  const email = (seller.email || "").toLowerCase();
  const tags = seller.tags || [];
  const sellerIsTest =
    tags.includes("test_user") || email.endsWith("@testuser.com");
  if (!sellerIsTest) {
    return {
      ok: false,
      blockedReason: "MP TEST CREDENTIAL MODE MISMATCH",
      operator: {
        checkoutUrl: "",
        buyerEmailHint: "",
        registrationRef: "",
        editionSlug: "clickaton-argentina-2026",
        amountPesos: 0,
        currency: "ARS",
      },
      sellerAudit: {
        sellerId: seller.id ?? null,
        nickname: seller.nickname ?? null,
        siteId: seller.site_id ?? null,
        emailDomain: email.includes("@") ? email.split("@")[1] : null,
        tags,
        sellerIsTest: false,
      },
      ids: {
        registrationId: "",
        paymentOrderId: null,
        preferenceId: null,
        accessToken: "",
      },
    };
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
                include: { variants: { where: { isActive: true }, take: 1 } },
              },
            },
          },
        },
      },
    },
  });
  if (!edition?.isPublished || !edition.registrationEnabled) {
    throw new Error("ar2026_not_open");
  }
  const ticket = edition.ticketTypes[0];
  if (!ticket) throw new Error("missing_general_ticket");

  await ensureStagingTestEditionFinance(edition.id);

  const now = Date.now();
  const phase = edition.pricePhases.find(
    (p) => p.startsAt.getTime() <= now && p.endsAt.getTime() >= now,
  );
  const shirt = phase?.includedItems.find(
    (i) => i.product.code === "REMERA-CLICKATON",
  );
  const variant = shirt?.product.variants[0];

  const suffix = randomBytes(3).toString("hex");
  const buyerEmail =
    process.env.MERCADOPAGO_TEST_BUYER_EMAIL?.trim().toLowerCase() ||
    `buyer.10c3.${suffix}@testuser.com`;
  if (email && buyerEmail === email) {
    throw new Error("buyer_must_differ_from_seller");
  }

  const assetId = `asset_10c3_${suffix}`;
  await prisma.dnxMediaAsset.create({
    data: {
      id: assetId,
      platform: "CLICKATON",
      ownerType: "GUEST_UPLOAD",
      ownerId: `guest_10c3_${suffix}`,
      kind: "PROFILE_SQUARE",
      storageBackend: "LOCAL_TEST",
      storageKey: `clickaton/10c3/${suffix}.jpg`,
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
      firstName: "Buyer",
      lastName: "TenC3",
      email: buyerEmail,
      phone: "1111111111",
      documentNumber: `30${suffix}${Math.floor(Math.random()*90+10)}`.slice(0, 8),
      city: "CABA",
      province: "CABA",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    imageUsageConsent: true,
    socialPublicationConsent: true,
    profilePhotoAssetId: assetId,
    instagramHandle: `buyer10c3_${suffix}`,
    idempotencyKey: `10c3-${suffix}-${randomUUID().slice(0, 8)}`,
  });

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
  const webhookSecret = readEnv("DNX_PAYMENTS_WEBHOOK_SECRET");
  const webhookPublic =
    process.env.DNX_PAYMENTS_WEBHOOK_PUBLIC_URL ??
    `${publicBaseUrl.replace(/\/$/, "")}/api/webhooks/dnx-payments`;

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
    const u = new URL(redirect.checkoutUrl);
    preferenceId = u.searchParams.get("pref_id");
  } catch {
    preferenceId = null;
  }

  let preferenceAudit: Record<string, unknown> = {};
  if (preferenceId) {
    const pref = await fetchPreference(accessToken, preferenceId);
    const collectorId = pref.collector_id;
    preferenceAudit = {
      preferenceIdMasked: maskId(preferenceId),
      liveMode: pref.live_mode ?? null,
      collectorId,
      collectorMatchesSeller: String(collectorId) === String(seller.id),
      externalReferenceMasked: maskId(String(pref.external_reference ?? "")),
      notificationHost: (() => {
        try {
          return new URL(String(pref.notification_url ?? "")).host;
        } catch {
          return null;
        }
      })(),
      amount: (pref.items as Array<{ unit_price?: number }> | undefined)?.[0]
        ?.unit_price,
      marketplace: pref.marketplace ?? null,
    };
    if (pref.live_mode === true) {
      return {
        ok: false,
        blockedReason: "MP TEST CREDENTIAL MODE MISMATCH",
        operator: {
          checkoutUrl: "",
          buyerEmailHint: "",
          registrationRef: maskId(summary.registrationId),
          editionSlug: edition.slug,
          amountPesos: 0,
          currency: "ARS",
        },
        sellerAudit: {
          sellerId: seller.id ?? null,
          nickname: seller.nickname ?? null,
          siteId: seller.site_id ?? null,
          emailDomain: email.includes("@") ? email.split("@")[1] : null,
          tags,
          sellerIsTest: true,
          preference: preferenceAudit,
          mismatch: "preference_live_mode_true",
        },
        ids: {
          registrationId: summary.registrationId,
          paymentOrderId: redirect.paymentOrderId ?? null,
          preferenceId,
          accessToken: accessTok,
        },
      };
    }
    if (String(collectorId) !== String(seller.id)) {
      return {
        ok: false,
        blockedReason: "MP TEST CREDENTIAL MODE MISMATCH",
        operator: {
          checkoutUrl: "",
          buyerEmailHint: "",
          registrationRef: maskId(summary.registrationId),
          editionSlug: edition.slug,
          amountPesos: 0,
          currency: "ARS",
        },
        sellerAudit: {
          sellerId: seller.id ?? null,
          nickname: seller.nickname ?? null,
          preference: preferenceAudit,
          mismatch: "collector_seller_mismatch",
        },
        ids: {
          registrationId: summary.registrationId,
          paymentOrderId: redirect.paymentOrderId ?? null,
          preferenceId,
          accessToken: accessTok,
        },
      };
    }
  }

  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: summary.registrationId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      userId: true,
      totalAmount: true,
      currency: true,
      paymentOrderId: true,
    },
  });

  const bundle: ManualCheckoutBundle = {
    ok: true,
    blockedReason: null,
    operator: {
      checkoutUrl: redirect.checkoutUrl,
      buyerEmailHint: buyerEmail.includes("@")
        ? `${buyerEmail.slice(0, 3)}***@${buyerEmail.split("@")[1]}`
        : "testuser.com",
      registrationRef: maskId(summary.registrationId),
      editionSlug: edition.slug,
      amountPesos: (reg?.totalAmount ?? redirect.amountMinor) / 100,
      currency: reg?.currency ?? redirect.currency,
    },
    sellerAudit: {
      sellerId: seller.id ?? null,
      nickname: seller.nickname ?? null,
      siteId: seller.site_id ?? null,
      emailDomain: email.includes("@") ? email.split("@")[1] : null,
      tags,
      sellerIsTest: true,
      credentialsSource,
      providerMode: mode,
      preference: preferenceAudit,
      registration: {
        status: reg?.status,
        paymentStatus: reg?.paymentStatus,
        userId: reg?.userId,
        phaseName: phase?.name ?? null,
        shirtStockLimit: shirt?.stockLimit ?? null,
        hasMerch: Boolean(shirt && variant),
      },
    },
    ids: {
      registrationId: summary.registrationId,
      paymentOrderId: redirect.paymentOrderId ?? reg?.paymentOrderId ?? null,
      preferenceId,
      accessToken: accessTok,
    },
  };

  // Persist for watcher (local tmp only; contains access token — not for docs)
  writeFileSync(
    "/tmp/clickaton_10c3_manual_bundle.json",
    JSON.stringify(
      {
        ...bundle,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  writeFileSync("/tmp/clickaton_10c3_checkout_url.txt", redirect.checkoutUrl);

  return bundle;
}

async function main() {
  const bundle = await prepare10c3ManualCheckout();
  // Operator-safe stdout (no access token)
  const safe = {
    ok: bundle.ok,
    blockedReason: bundle.blockedReason,
    operator: bundle.operator,
    sellerAudit: bundle.sellerAudit,
    ids: {
      registrationId: maskId(bundle.ids.registrationId),
      paymentOrderId: maskId(bundle.ids.paymentOrderId),
      preferenceId: maskId(bundle.ids.preferenceId),
    },
  };
  console.log(JSON.stringify(safe, null, 2));
  if (!bundle.ok) process.exit(2);
}

const isMain =
  process.argv[1]?.includes("prepare-10c3-manual-checkout") ||
  import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main()
    .catch((e) => {
      console.error(
        "PREPARE_FAIL",
        e instanceof Error ? e.message.slice(0, 240) : e,
      );
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
