/**
 * Comisión del fotógrafo dueño del cupón, de punta a punta contra el
 * repositorio en memoria: se anota PENDING en la misma alta que la inscripción.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { withCouponAffiliate } from "@/lib/affiliates/domain/coupon-affiliate";
import { fixedClock } from "@/lib/timeline/clock";

import {
  createInMemoryPublicRegistrationRepository,
  newIdempotencyKey,
} from "../infrastructure/in-memory-public-registration-repository";
import { crearEscenario } from "./location-consent-funnel.fixture";
import {
  createPublicRegistrationService,
  type PromotionsPort,
} from "./public-registration-service";

const AHORA = new Date("2026-10-01T12:00:00.000Z");
const PROMO_ID = "promo_ana";

/** Cupón de 10% de descuento, siempre válido. */
function cuponDiezPorCiento(): PromotionsPort {
  return {
    async reserve(input) {
      const discountAmount = Math.round(input.originalAmount / 10);
      return {
        ok: true,
        applied: {
          quote: {
            promotionId: PROMO_ID,
            code: input.code.toUpperCase(),
            discountAmount,
            finalAmount: input.originalAmount - discountAmount,
            originalAmount: input.originalAmount,
          },
        },
      };
    },
    async attachRegistration() {},
    async releaseByRegistration() {
      return 0;
    },
  };
}

function escenario(opts?: {
  affiliateActive?: boolean;
  conDueno?: boolean;
  repoOverrides?: Record<string, unknown>;
}) {
  const esc = crearEscenario();
  if (opts?.conDueno !== false) {
    esc.store.promotionMetadata.set(
      PROMO_ID,
      withCouponAffiliate({ eligibility: null }, { affiliateId: "aff_ana", commissionBps: 1000 }),
    );
  }
  esc.store.affiliatesActive.set("aff_ana", opts?.affiliateActive ?? true);
  esc.store.editionMpFeeBps.set("ed_consent", 600);
  const clock = fixedClock(AHORA);
  const repo = {
    ...createInMemoryPublicRegistrationRepository(esc.store, { clock }),
    ...(opts?.repoOverrides ?? {}),
  };
  const service = createPublicRegistrationService({
    repo,
    clock,
    promotions: cuponDiezPorCiento(),
  });
  return { ...esc, service };
}

function inscribir(
  esc: ReturnType<typeof escenario>,
  extra?: { homeDelivery?: Record<string, unknown>; promoCode?: string },
) {
  return esc.service.createRegistration({
    editionSlug: esc.editionSlug,
    venueId: null,
    ticketTypeId: esc.ticketTypeId,
    variantChoices: [],
    participant: {
      firstName: "Ana",
      lastName: "Pérez",
      email: `ana+${newIdempotencyKey()}@example.com`,
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    instagramHandle: "anaperez",
    profilePhotoAssetId: "asset-test",
    idempotencyKey: newIdempotencyKey(),
    promoCode: extra?.promoCode ?? "fotoana",
    homeDelivery: extra?.homeDelivery,
  });
}

test("cupón con dueño: se anota la comisión PENDING sobre el precio de lista", async () => {
  const esc = escenario();
  const s = await inscribir(esc);
  assert.equal(s.totalAmount, 1_350_000);

  const comision = esc.store.affiliateCommissions.get(s.registrationId);
  assert.deepEqual(comision, {
    affiliateId: "aff_ana",
    promotionId: PROMO_ID,
    promotionCodeSnapshot: "FOTOANA",
    commissionBps: 1000,
    baseAmount: 1_500_000,
    grossAmount: 150_000,
    mpFeeBps: 600,
    mpFeeShareAmount: 9_000,
    netAmount: 141_000,
    editionId: "ed_consent",
    status: "PENDING",
  });
});

test("con envío: la base no incluye el envío aunque el total sí", async () => {
  const esc = escenario();
  esc.store.homeDeliveryConfigs.set("ed_consent", {
    enabled: true,
    feeAmount: 1_000_000,
    guaranteedUntil: new Date("2026-12-13T02:59:59.999Z"),
    excludedCity: "Rosario",
    excludedProvince: "Santa Fe",
  });
  const s = await inscribir(esc, {
    homeDelivery: {
      recipientName: "Ana Pérez",
      documentNumber: "30123456",
      phone: "3515551234",
      street: "Av. Colón",
      streetNumber: "1234",
      city: "Córdoba",
      province: "Córdoba",
      postalCode: "5000",
    },
  });
  assert.equal(s.totalAmount, 2_350_000);
  const comision = esc.store.affiliateCommissions.get(s.registrationId);
  assert.equal(comision?.baseAmount, 1_500_000);
  assert.equal(comision?.grossAmount, 150_000);
  assert.equal(comision?.netAmount, 141_000);
});

test("cupón sin dueño o afiliado desactivado: no hay comisión", async () => {
  const sinDueno = escenario({ conDueno: false });
  const a = await inscribir(sinDueno);
  assert.equal(sinDueno.store.affiliateCommissions.has(a.registrationId), false);

  const inactivo = escenario({ affiliateActive: false });
  const b = await inscribir(inactivo);
  assert.equal(inactivo.store.affiliateCommissions.has(b.registrationId), false);
});

test("si falla la lectura del dueño, la inscripción sale igual sin comisión", async () => {
  const esc = escenario({
    repoOverrides: {
      async getAffiliateCommissionContext() {
        throw new Error('relation "ClickatonAffiliate" does not exist');
      },
    },
  });
  const s = await inscribir(esc);
  assert.equal(s.totalAmount, 1_350_000);
  assert.ok(esc.store.domain.registrations.has(s.registrationId));
  assert.equal(esc.store.affiliateCommissions.has(s.registrationId), false);
});
