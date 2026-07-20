/**
 * Selfcheck 10D3F-B — expiración, token, PII, duplicados, eligibility, rate limit.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicRegistrationService } from "../lib/public-registration/application/public-registration-service";
import {
  signRegistrationAccessToken,
  verifyRegistrationAccessToken,
} from "../lib/public-registration/domain/access-token";
import {
  createInMemoryPublicRegistrationRepository,
  createInMemoryPublicStore,
  seedPublicEdition,
  seedPublicTicket,
  seedPublicVariant,
  seedPublicVenue,
} from "../lib/public-registration/infrastructure/in-memory-public-registration-repository";
import {
  createInMemoryRateLimitStore,
  hashRateLimitSubject,
  PUBLIC_REGISTRATION_RATE_LIMIT,
} from "../lib/public-registration/domain/rate-limit";
import { setPublicRegistrationServiceForTests } from "../lib/public-registration/actions/runtime";

const ROOT = join(process.cwd());

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`public-registration-hardening.selfcheck: ${msg}`);
}

function file(rel: string) {
  const p = join(ROOT, rel);
  assert(existsSync(p), `missing ${rel}`);
  return readFileSync(p, "utf8");
}

async function main() {
  file("scripts/expire-registration-holds.ts");
  file("lib/public-registration/application/expire-pending-registrations.ts");
  file("lib/public-registration/application/checkout-eligibility.ts");

  const wizard = file("components/public-registration/PublicRegistrationWizard.tsx");
  assert(wizard.includes("sessionStorage"), "idem key persistence");
  assert(!wizard.includes("@prisma/client"), "no prisma client");
  assert(!wizard.includes("createExpirePending"), "no expire in client");

  const expireSrc = file("lib/public-registration/application/expire-pending-registrations.ts");
  assert(!expireSrc.includes("Mercado Pago"), "no payments");
  assert(!expireSrc.includes("dnx-payments"), "no dnx payments");

  const store = createInMemoryPublicStore();
  const now = Date.now();
  seedPublicEdition(store, {
    id: "ed1",
    slug: "harden-2026",
    name: "Harden",
    shortDescription: null,
    status: "REGISTRATION_OPEN",
    isPublished: true,
    registrationOpenAt: new Date(now - 86_400_000),
    registrationCloseAt: new Date(now + 86_400_000),
    startAt: null,
    endAt: null,
    timezone: "America/Argentina/Buenos_Aires",
    visibleCodePrefix: "H26",
  });
  seedPublicVenue(store, {
    id: "vn1",
    editionId: "ed1",
    name: "Sede",
    city: "CABA",
    province: "CABA",
    address: null,
    startAt: null,
    isActive: true,
  });
  seedPublicVariant(store, {
    id: "var_m",
    productId: "p1",
    name: "M",
    sku: "M",
    stock: 10,
    reservedStock: 0,
  });
  seedPublicTicket(store, {
    id: "tt1",
    editionId: "ed1",
    venueId: null,
    name: "General",
    description: null,
    code: "G",
    priceAmount: 1000_00,
    currency: "ARS",
    capacity: 5,
    holdMinutes: 20,
    isActive: true,
    salesStartAt: new Date(now - 1000),
    salesEndAt: new Date(now + 86_400_000),
    products: [
      {
        productId: "p1",
        productName: "Remera",
        quantity: 1,
        requiresVariantChoice: true,
        fixedVariant: null,
        variants: [
          { id: "var_m", name: "M", sku: "M", availableStock: 10, isActive: true },
        ],
      },
    ],
  });

  const repo = createInMemoryPublicRegistrationRepository(store);
  const rateLimit = createInMemoryRateLimitStore();
  const svc = createPublicRegistrationService({
    repo,
    rateLimit,
    rateLimitSubject: "test-ip",
  });
  setPublicRegistrationServiceForTests(svc);

  // 1 pending not expired
  const live = await svc.createRegistration({
    editionSlug: "harden-2026",
    venueId: "vn1",
    ticketTypeId: "tt1",
    variantChoices: [{ productId: "p1", productVariantId: "var_m" }],
    participant: {
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "1112345678",
      documentNumber: "30123456",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: false,
    idempotencyKey: "idem_live_1",
  });
  assert(live.status === "PENDING_PAYMENT", "1 pending");
  assert(live.reservationActive, "1 active");
  assert(live.checkoutEligible, "22 eligible");
  assert(live.participant.emailMasked.includes("•••@"), "19 email masked");
  assert(live.participant.documentMasked.startsWith("••••"), "19 doc masked");
  assert(!("email" in live.participant), "19 no raw email field");
  assert(!("lastName" in live.participant), "19 no raw lastName field");

  const reservedAfterCreate = store.variants.get("var_m")!.reservedStock;
  assert(reservedAfterCreate === 1, "stock reserved");
  const stockReal = store.variants.get("var_m")!.stock;
  assert(stockReal === 10, "7 real stock unchanged");

  // dry-run expire should not mutate
  const past = new Date(now + 60_000);
  // force hold expiry in past for a second registration
  const live2 = await svc.createRegistration({
    editionSlug: "harden-2026",
    venueId: "vn1",
    ticketTypeId: "tt1",
    variantChoices: [{ productId: "p1", productVariantId: "var_m" }],
    participant: {
      firstName: "Bob",
      lastName: "Lopez",
      email: "bob@example.com",
      phone: "2222345678",
      documentNumber: "30999888",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: false,
    idempotencyKey: "idem_live_2",
  });
  const row2 = store.domain.registrations.get(live2.registrationId)!;
  row2.holdExpiresAt = new Date(now - 1000);
  for (const h of store.domain.capacityHolds.values()) {
    if (h.registrationId === live2.registrationId) h.expiresAt = new Date(now - 1000);
  }
  for (const h of store.domain.stockHolds.values()) {
    if (h.registrationId === live2.registrationId) h.expiresAt = new Date(now - 1000);
  }

  const dry = await svc.expirePendingRegistrations({
    now: new Date(now),
    limit: 10,
    dryRun: true,
  });
  assert(dry.dryRun && dry.expired >= 1, "13 dry-run counts");
  assert(store.domain.registrations.get(live2.registrationId)!.status === "PENDING_PAYMENT", "13 no mutate");

  const expiredBatch = await svc.expirePendingRegistrations({
    now: new Date(now),
    limit: 10,
    dryRun: false,
  });
  assert(expiredBatch.expired >= 1, "2 expired");
  assert(expiredBatch.releasedCapacityHolds >= 1, "5 capacity released");
  assert(expiredBatch.releasedStockHolds >= 1, "6 stock hold released");
  const after = store.domain.registrations.get(live2.registrationId)!;
  assert(after.status === "CANCELLED" && after.paymentStatus === "EXPIRED", "2 status");
  assert(store.variants.get("var_m")!.stock === 10, "7 stock still");
  assert(
    store.domain.audits.some(
      (a) => a.registrationId === live2.registrationId && a.action === "PUBLIC_REGISTRATION_EXPIRED",
    ),
    "11 audit",
  );

  // 8/9 idempotent re-expire
  const again = await svc.expirePendingRegistrations({ now: new Date(now), dryRun: false });
  assert(again.expired === 0, "8 no double expire");

  const [c1, c2] = await Promise.all([
    repo.expireRegistration({
      registrationId: live2.registrationId,
      now: new Date(now),
      dryRun: false,
    }),
    repo.expireRegistration({
      registrationId: live2.registrationId,
      now: new Date(now),
      dryRun: false,
    }),
  ]);
  assert(
    [c1, c2].every((x) => x.outcome === "already_processed" || x.outcome === "skipped"),
    "10 concurrent workers",
  );

  // 3 confirmed does not expire
  const conf = store.domain.registrations.get(live.registrationId)!;
  conf.status = "CONFIRMED";
  conf.paymentStatus = "APPROVED";
  conf.holdExpiresAt = new Date(now - 1000);
  const confBatch = await svc.expirePendingRegistrations({ now: new Date(now), dryRun: false });
  assert(
    store.domain.registrations.get(live.registrationId)!.status === "CONFIRMED",
    "3 confirmed intact",
  );
  void confBatch;

  // 4 cancelled does not expire again meaningfully
  const cancelProbeId = live2.registrationId;
  const cancelBatch = await repo.expireRegistration({
    registrationId: cancelProbeId,
    now: new Date(now),
    dryRun: false,
  });
  assert(cancelBatch.outcome === "already_processed", "4 already expired skipped");

  // reinstate a pending for token tests
  const tokReg = await svc.createRegistration({
    editionSlug: "harden-2026",
    venueId: "vn1",
    ticketTypeId: "tt1",
    variantChoices: [{ productId: "p1", productVariantId: "var_m" }],
    participant: {
      firstName: "Cara",
      lastName: "Xu",
      email: "cara@example.com",
      phone: "3332345678",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: false,
    idempotencyKey: "idem_tok",
  });

  const good = verifyRegistrationAccessToken({
    registrationId: tokReg.registrationId,
    editionSlug: "harden-2026",
    token: tokReg.accessToken,
  });
  assert(good.ok, "14 token valid");

  const altered = verifyRegistrationAccessToken({
    registrationId: tokReg.registrationId,
    editionSlug: "harden-2026",
    token: tokReg.accessToken.slice(0, -2) + "xx",
  });
  assert(!altered.ok && altered.code === "TOKEN_INVALID", "15 altered");

  const otherId = verifyRegistrationAccessToken({
    registrationId: "reg_other",
    editionSlug: "harden-2026",
    token: tokReg.accessToken,
  });
  assert(!otherId.ok, "16 other registration");

  const wrongSlug = verifyRegistrationAccessToken({
    registrationId: tokReg.registrationId,
    editionSlug: "otra-edicion",
    token: tokReg.accessToken,
  });
  assert(!wrongSlug.ok, "18 slug altered");

  const expiredTok = signRegistrationAccessToken({
    registrationId: tokReg.registrationId,
    editionSlug: "harden-2026",
    expiresAtMs: Date.now() - 1000,
  });
  const expV = verifyRegistrationAccessToken({
    registrationId: tokReg.registrationId,
    editionSlug: "harden-2026",
    token: expiredTok,
  });
  assert(!expV.ok && expV.code === "TOKEN_EXPIRED", "17 token expired");

  // 21 reinscription after expired
  const re = await svc.createRegistration({
    editionSlug: "harden-2026",
    venueId: "vn1",
    ticketTypeId: "tt1",
    variantChoices: [{ productId: "p1", productVariantId: "var_m" }],
    participant: {
      firstName: "Bob",
      lastName: "Lopez",
      email: "bob@example.com",
      phone: "2222345678",
      documentNumber: "30999888",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: false,
    idempotencyKey: "idem_re_bob",
  });
  assert(re.status === "PENDING_PAYMENT", "21 re-register after expire");

  // 20 duplicate active
  await svc
    .createRegistration({
      editionSlug: "harden-2026",
      venueId: "vn1",
      ticketTypeId: "tt1",
      variantChoices: [{ productId: "p1", productVariantId: "var_m" }],
      participant: {
        firstName: "Cara",
        lastName: "Yu",
        email: "cara@example.com",
        phone: "3332345678",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: false,
      idempotencyKey: "idem_dup_cara",
    })
    .then(
      () => assert(false, "20 dup"),
      (e: { code?: string }) =>
        assert(e.code === "DUPLICATE_REGISTRATION", `20 code got ${e.code}`),
    );

  // eligibility expired
  const bobExpiredRow = store.domain.registrations.get(live2.registrationId)!;
  await svc
    .getRegistrationCheckoutEligibility({
      registrationId: bobExpiredRow.id,
      editionSlug: "harden-2026",
      accessToken: signRegistrationAccessToken({
        registrationId: bobExpiredRow.id,
        editionSlug: "harden-2026",
        expiresAtMs: Date.now() + 60_000,
      }),
    })
    .then((el) => {
      assert(!el.eligible && el.reason === "registration_expired", "23 eligibility expired");
    });

  // 24/26 confirmed + approved not payable
  const confirmedId = live.registrationId;
  assert(store.domain.registrations.get(confirmedId)!.status === "CONFIRMED", "preconfirmed");
  const elConf = await svc.getRegistrationCheckoutEligibility({
    registrationId: confirmedId,
    editionSlug: "harden-2026",
    accessToken: signRegistrationAccessToken({
      registrationId: confirmedId,
      editionSlug: "harden-2026",
      expiresAtMs: Date.now() + 60_000,
    }),
  });
  assert(!elConf.eligible, "24/26 confirmed/approved not payable");

  // 28 rate limit — agotar ventana antes del create
  const tiny = createInMemoryRateLimitStore();
  const rlKey = hashRateLimitSubject("create:burst");
  for (let i = 0; i < PUBLIC_REGISTRATION_RATE_LIMIT.limit; i += 1) {
    const r = await tiny.consume(rlKey, PUBLIC_REGISTRATION_RATE_LIMIT.limit, 60_000);
    assert(r.allowed, "prefill rl");
  }
  const limitedSvc = createPublicRegistrationService({
    repo,
    rateLimit: tiny,
    rateLimitSubject: "burst",
  });
  await limitedSvc
    .createRegistration({
      editionSlug: "harden-2026",
      venueId: "vn1",
      ticketTypeId: "tt1",
      variantChoices: [{ productId: "p1", productVariantId: "var_m" }],
      participant: {
        firstName: "R",
        lastName: "L",
        email: "rl-burst@example.com",
        phone: "4442345678",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: false,
      idempotencyKey: `idem_rl_burst`,
    })
    .then(
      () => assert(false, "28 should rate limit"),
      (e: { code?: string }) => assert(e.code === "RATE_LIMITED", "28 rate limited"),
    );
  void past;
  void rateLimit;

  // batch limit
  const limited = await svc.expirePendingRegistrations({ limit: 1, dryRun: true });
  assert(limited.scanned <= 1, "12 batch limit");

  assert(!file("lib/public-registration/application/expire-pending-registrations.ts").includes("deleteMany"), "33 no hard delete");

  setPublicRegistrationServiceForTests(null);
  console.log("clickaton public-registration-hardening.selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
