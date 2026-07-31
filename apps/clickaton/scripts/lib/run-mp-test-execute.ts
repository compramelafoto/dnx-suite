/**
 * Ejecución smoke Mercado Pago TEST (10D3H-C).
 * Solo llamar tras check-config verde + --confirm-test-only.
 * Nunca imprime secretos ni payloads completos.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createPublicRegistrationService } from "../../lib/public-registration/application/public-registration-service";
import { createPrismaPublicRegistrationRepository } from "../../lib/public-registration/infrastructure/prisma-public-registration-repository";
import { createCheckoutService } from "../../lib/checkout/application/checkout-service";
import { createPrismaCheckoutMutations } from "../../lib/checkout/infrastructure/prisma-checkout-mutations";
import { createDurableDnxPaymentsClient } from "../../lib/checkout/infrastructure/durable-dnx-payments-client";
import { createCheckoutLogSink } from "../../lib/checkout/domain/observability";
import { signRegistrationAccessToken } from "../../lib/public-registration/domain/access-token";
import {
  createPrismaDnxPaymentsPersistence,
  createMercadoPagoCheckoutProTestAdapter,
  createMercadoPagoTestClickatonProviderBridge,
  resolveClickatonPaymentsProviderMode,
  type DnxPaymentsPrismaDelegates,
} from "@repo/payments/next";

export type ExecuteEvidence = {
  registrationId: string;
  orderId: string | null;
  preferenceIdMasked: string | null;
  checkoutHost: string | null;
  amountMinor: number;
  currency: string;
  externalReferenceMasked: string | null;
  dnxStatus: string | null;
  registrationStatus: string | null;
  paymentStatus: string | null;
  holdsCapacity: string | null;
  holdsStock: string | null;
  confirmedAt: string | null;
  reconciliation: string | null;
  idempotentRefresh: boolean;
  liveModeSeen: boolean;
};

function maskId(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.length <= 10) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function readEnv(name: string): string {
  const v = (process.env as Record<string, string | undefined>)[name]?.trim();
  if (!v) throw new Error(`missing_env:${name}`);
  return v;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function seedSmokeCatalog(suffix: string) {
  const editionId = `ed_smoke_${suffix}`;
  const venueId = `vn_smoke_${suffix}`;
  const ticketId = `tt_smoke_${suffix}`;
  const slug = `smoke-mp-test-${suffix}`;
  const now = Date.now();

  await prisma.clickatonEdition.create({
    data: {
      id: editionId,
      name: "CLICKATÓN TEST Smoke",
      slug,
      shortDescription: "TEST ONLY",
      status: "REGISTRATION_OPEN",
      isPublished: true,
      registrationEnabled: true,
      registrationOpenAt: new Date(now - 86_400_000),
      registrationCloseAt: new Date(now + 86_400_000),
      timezone: "America/Argentina/Buenos_Aires",
      visibleCodePrefix: "TST",
      defaultCapacity: 50,
    },
  });
  await prisma.clickatonVenue.create({
    data: {
      id: venueId,
      editionId,
      name: "Sede TEST",
      slug: `sede-${suffix}`,
      city: "CABA",
      country: "AR",
      isActive: true,
      capacity: 50,
    },
  });
  await prisma.clickatonTicketType.create({
    data: {
      id: ticketId,
      editionId,
      venueId,
      name: "Entrada CLICKATÓN TEST",
      code: `SMOKE_${suffix}`,
      description: "CLICKATÓN TEST",
      priceAmount: 1500,
      currency: "ARS",
      capacity: 20,
      holdMinutes: 45,
      isActive: true,
      salesStartAt: new Date(now - 1000),
      salesEndAt: new Date(now + 86_400_000),
    },
  });

  const profilePhotoAssetId = `asset_smoke_${suffix}`;
  await prisma.dnxMediaAsset.create({
    data: {
      id: profilePhotoAssetId,
      platform: "CLICKATON",
      ownerType: "GUEST_UPLOAD",
      ownerId: `guest_smoke_${suffix}`,
      kind: "PROFILE_SQUARE",
      storageBackend: "LOCAL_TEST",
      storageKey: `clickaton/smoke/${suffix}/profile.jpg`,
      mimeType: "image/jpeg",
      bytes: 1024,
      contentHash: `smoke_hash_${suffix}`,
      width: 400,
      height: 400,
    },
  });

  return { editionId, venueId, ticketId, slug, profilePhotoAssetId };
}

function buildCheckoutService(publicBaseUrl: string) {
  const mode = resolveClickatonPaymentsProviderMode(
    process.env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual",
  );
  if (mode !== "mercado_pago_test") {
    throw new Error("execute_requires_mercado_pago_test");
  }
  const token = readEnv("MERCADOPAGO_TEST_ACCESS_TOKEN");
  const sourceRaw = process.env.MERCADOPAGO_CREDENTIALS_SOURCE ?? "unknown";
  const credentialsSource =
    sourceRaw === "credenciales_de_prueba"
      ? "credenciales_de_prueba"
      : sourceRaw === "production_panel"
        ? "production_panel"
        : "unknown";
  const adapter = createMercadoPagoCheckoutProTestAdapter({
    accessToken: token,
    publicKey: process.env.MERCADOPAGO_TEST_PUBLIC_KEY,
    credentialsSource,
  });
  const bridge = createMercadoPagoTestClickatonProviderBridge({ adapter });
  const webhookSecret = readEnv("DNX_PAYMENTS_WEBHOOK_SECRET");
  const webhookPublic =
    process.env.DNX_PAYMENTS_WEBHOOK_PUBLIC_URL ??
    `${publicBaseUrl.replace(/\/$/, "")}/api/webhooks/dnx-payments`;

  const payments = createDurableDnxPaymentsClient({
    persistence: createPrismaDnxPaymentsPersistence(
      prisma as unknown as DnxPaymentsPrismaDelegates,
    ),
    webhookSecret,
    checkoutBaseUrl: "https://payments.test/checkout",
    notificationUrl: webhookPublic,
    providerBridge: bridge,
    isTestFixture: true,
  });

  const publicRepo = createPrismaPublicRegistrationRepository();
  return createCheckoutService({
    publicRepo,
    payments,
    mutations: createPrismaCheckoutMutations(),
    log: createCheckoutLogSink(),
    publicBaseUrl,
  });
}

export async function runMercadoPagoTestExecute(opts?: {
  pollMs?: number;
  pollIntervalMs?: number;
  waitForExternalCheckout?: boolean;
}): Promise<{ ok: boolean; evidence: ExecuteEvidence; checkoutUrl: string }> {
  const publicBaseUrl = readEnv("CLICKATON_PUBLIC_URL");
  if (!publicBaseUrl.includes("clickaton-staging")) {
    throw new Error("execute_requires_clickaton_staging_public_url");
  }

  const suffix = randomBytes(3).toString("hex");
  const catalog = await seedSmokeCatalog(suffix);
  const { ensureStagingTestEditionFinance } = await import("./seed-staging-test-finance");
  await ensureStagingTestEditionFinance(catalog.editionId);
  /* eslint-disable turbo/no-undeclared-env-vars -- TEST buyer from operator shell */
  const buyerEmail =
    process.env.MERCADOPAGO_TEST_BUYER_EMAIL?.trim().toLowerCase() ||
    `buyer.smoke.${suffix}@testuser.com`;
  /* eslint-enable turbo/no-undeclared-env-vars */

  const publicRepo = createPrismaPublicRegistrationRepository();
  const pub = createPublicRegistrationService({ repo: publicRepo });
  const summary = await pub.createRegistration({
    editionSlug: catalog.slug,
    venueId: catalog.venueId,
    ticketTypeId: catalog.ticketId,
    variantChoices: [],
    participant: {
      firstName: "Test",
      lastName: "Buyer",
      email: buyerEmail,
      phone: "1111111111",
      documentNumber: "30111222",
      city: "CABA",
      province: "CABA",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    imageUsageConsent: true,
    socialPublicationConsent: true,
    profilePhotoAssetId: catalog.profilePhotoAssetId,
    instagramHandle: `smoke_ck_${suffix}`,
    idempotencyKey: `smoke-mp-${suffix}-${randomUUID().slice(0, 8)}`,
  });

  const accessToken =
    summary.accessToken ||
    signRegistrationAccessToken({
      registrationId: summary.registrationId,
      editionSlug: catalog.slug,
      expiresAtMs: Date.now() + 45 * 60_000,
    });

  const checkout = buildCheckoutService(publicBaseUrl);
  const redirect = await checkout.createCheckout({
    registrationId: summary.registrationId,
    editionSlug: catalog.slug,
    accessToken,
    publicBaseUrl,
  });

  let checkoutHost: string | null = null;
  try {
    checkoutHost = new URL(redirect.checkoutUrl).host;
  } catch {
    checkoutHost = null;
  }

  console.log("EXECUTE: registration created");
  console.log(`registration_id=${maskId(summary.registrationId)}`);
  console.log(`order_id=${maskId(redirect.paymentOrderId)}`);
  console.log(`checkout_host=${checkoutHost}`);
  console.log(`amount_minor=${redirect.amountMinor} currency=${redirect.currency}`);
  console.log("EXECUTE: complete Checkout Pro TEST in browser (tarjeta oficial TEST).");
  console.log(`CHECKOUT_URL=${redirect.checkoutUrl}`);

  const pollMs = opts?.pollMs ?? 180_000;
  const interval = opts?.pollIntervalMs ?? 5_000;
  const deadline = Date.now() + pollMs;
  let lastStatus = await checkout.getPaymentStatus({
    registrationId: summary.registrationId,
    editionSlug: catalog.slug,
    accessToken,
  });

  while (Date.now() < deadline && !lastStatus.confirmed) {
    await sleep(interval);
    lastStatus = await checkout.refreshPaymentStatus({
      registrationId: summary.registrationId,
      editionSlug: catalog.slug,
      accessToken,
    });
    console.log(
      `poll status=${lastStatus.normalizedOrderStatus} reg=${lastStatus.registrationStatus} pay=${lastStatus.paymentStatus}`,
    );
    if (
      lastStatus.normalizedOrderStatus === "REJECTED" ||
      lastStatus.normalizedOrderStatus === "CANCELLED"
    ) {
      break;
    }
  }

  const afterRefresh = await checkout.refreshPaymentStatus({
    registrationId: summary.registrationId,
    editionSlug: catalog.slug,
    accessToken,
  });
  const idempotent =
    afterRefresh.normalizedOrderStatus === lastStatus.normalizedOrderStatus &&
    afterRefresh.confirmed === lastStatus.confirmed;

  const reconciliation = await checkout.reconcileRegistration(summary.registrationId);

  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: summary.registrationId },
    include: { capacityHold: true, stockHolds: true },
  });
  const order = reg?.paymentOrderId
    ? await prisma.dnxPaymentOrder.findUnique({ where: { id: reg.paymentOrderId } })
    : null;
  const provider = reg?.paymentOrderId
    ? await prisma.dnxProviderOrder.findFirst({
        where: { paymentOrderId: reg.paymentOrderId },
      })
    : null;

  const evidence: ExecuteEvidence = {
    registrationId: summary.registrationId,
    orderId: reg?.paymentOrderId ?? redirect.paymentOrderId ?? null,
    preferenceIdMasked: maskId(provider?.providerOrderId ?? null),
    checkoutHost,
    amountMinor: reg?.totalAmount ?? redirect.amountMinor,
    currency: reg?.currency ?? redirect.currency,
    externalReferenceMasked: maskId(reg?.paymentExternalReference ?? null),
    dnxStatus: lastStatus.normalizedOrderStatus ?? order?.status ?? null,
    registrationStatus: reg?.status ?? lastStatus.registrationStatus,
    paymentStatus: reg?.paymentStatus ?? lastStatus.paymentStatus,
    holdsCapacity: reg?.capacityHold?.status ?? null,
    holdsStock: reg?.stockHolds?.[0]?.status ?? null,
    confirmedAt: reg?.confirmedAt?.toISOString() ?? null,
    reconciliation: reconciliation?.status ?? null,
    idempotentRefresh: idempotent,
    liveModeSeen: false,
  };

  const ok =
    evidence.dnxStatus === "APPROVED" &&
    evidence.registrationStatus === "CONFIRMED" &&
    evidence.paymentStatus === "APPROVED";

  console.log("EXECUTE_EVIDENCE", JSON.stringify(evidence));
  return { ok, evidence, checkoutUrl: redirect.checkoutUrl };
}
