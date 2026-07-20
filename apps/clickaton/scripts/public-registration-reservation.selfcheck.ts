/**
 * Selfcheck flujo público inscripción/reserva 10D3F — in-memory, sin Neon/pago.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicRegistrationService } from "../lib/public-registration/application/public-registration-service";
import {
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
  createPublicRegistrationAction,
  getPublicRegistrationContextAction,
  getPublicRegistrationSummaryAction,
} from "../lib/public-registration/actions/public-registration";
import { setPublicRegistrationServiceForTests } from "../lib/public-registration/actions/runtime";

const ROOT = join(process.cwd());

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`public-registration-reservation.selfcheck: ${msg}`);
}

function file(rel: string) {
  const p = join(ROOT, rel);
  assert(existsSync(p), `missing ${rel}`);
  return readFileSync(p, "utf8");
}

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

function baseParticipant(over: Record<string, string> = {}) {
  return {
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.com",
    phone: "11111111",
    documentNumber: "30123456",
    city: "CABA",
    province: "CABA",
    country: "AR",
    acceptTerms: "true",
    acceptPrivacy: "true",
    ...over,
  };
}

async function main() {
  // Static audits
  file("app/(public)/maratones/[slug]/inscripcion/page.tsx");
  file("app/(public)/maratones/[slug]/inscripcion/resumen/[registrationId]/page.tsx");
  file("app/(public)/legal/terminos/page.tsx");
  file("app/(public)/legal/privacidad/page.tsx");
  assert(!existsSync(join(ROOT, "app/(public)/admin/ordenes")), "no order routes");

  const wizard = file("components/public-registration/PublicRegistrationWizard.tsx");
  assert(wizard.includes('"use client"'), "wizard client");
  assert(!wizard.includes("@prisma/client"), "no prisma client");
  assert(!wizard.includes("@repo/db"), "no db client");
  assert(!wizard.includes("createPrismaPublicRegistrationRepository"), "no repo in client");
  assert(!wizard.includes("createPublicRegistrationService"), "no service in client");
  assert(!wizard.includes("Mercado Pago") && !wizard.includes("pagar ahora"), "no fake pay");

  const actions = file("lib/public-registration/actions/public-registration.ts");
  assert(!/hard.?delete|\.delete\(/i.test(actions), "no hard delete");
  assert(!actions.includes("method: \"GET\""), "no get mutate");

  const store = createInMemoryPublicStore();
  const now = Date.now();
  seedPublicEdition(store, {
    id: "ed1",
    slug: "cordoba-2026",
    name: "Córdoba 2026",
    shortDescription: "Demo",
    status: "REGISTRATION_OPEN",
    isPublished: true,
    registrationOpenAt: new Date(now - 86_400_000),
    registrationCloseAt: new Date(now + 86_400_000 * 30),
    startAt: new Date(now + 86_400_000 * 60),
    endAt: new Date(now + 86_400_000 * 61),
    timezone: "America/Argentina/Buenos_Aires",
    visibleCodePrefix: "COR26",
  });
  seedPublicVenue(store, {
    id: "vn1",
    editionId: "ed1",
    name: "Centro",
    city: "Córdoba",
    province: "Córdoba",
    address: "Calle 1",
    startAt: new Date(now + 86_400_000 * 60),
    isActive: true,
  });
  seedPublicVenue(store, {
    id: "vn_other",
    editionId: "ed_other",
    name: "Otra",
    city: "Rosario",
    province: "Santa Fe",
    address: null,
    startAt: null,
    isActive: true,
  });
  seedPublicVariant(store, {
    id: "var_m",
    productId: "prod_tee",
    name: "M",
    sku: "TEE-M",
    stock: 5,
  });
  seedPublicVariant(store, {
    id: "var_l",
    productId: "prod_tee",
    name: "L",
    sku: "TEE-L",
    stock: 0,
  });
  seedPublicTicket(store, {
    id: "tt_paid",
    editionId: "ed1",
    venueId: null,
    name: "General + remera",
    description: "Entrada con kit",
    code: "GEN",
    priceAmount: 4_000_000,
    currency: "ARS",
    capacity: 2,
    holdMinutes: 20,
    isActive: true,
    salesStartAt: new Date(now - 1000),
    salesEndAt: new Date(now + 86_400_000),
    products: [
      {
        productId: "prod_tee",
        productName: "Remera",
        quantity: 1,
        requiresVariantChoice: true,
        fixedVariant: null,
        variants: [
          { id: "var_m", name: "M", sku: "TEE-M", availableStock: 5, isActive: true },
          { id: "var_l", name: "L", sku: "TEE-L", availableStock: 0, isActive: true },
        ],
      },
    ],
  });
  seedPublicTicket(store, {
    id: "tt_free",
    editionId: "ed1",
    venueId: "vn1",
    name: "Cortesía",
    description: null,
    code: "FREE",
    priceAmount: 0,
    currency: "ARS",
    capacity: 10,
    holdMinutes: 15,
    isActive: true,
    salesStartAt: new Date(now - 1000),
    salesEndAt: new Date(now + 86_400_000),
    products: [],
  });
  seedPublicTicket(store, {
    id: "tt_future",
    editionId: "ed1",
    venueId: null,
    name: "Futura",
    description: null,
    code: "FUT",
    priceAmount: 1000,
    currency: "ARS",
    capacity: 10,
    holdMinutes: 20,
    isActive: true,
    salesStartAt: new Date(now + 86_400_000),
    salesEndAt: new Date(now + 86_400_000 * 2),
    products: [],
  });
  seedPublicTicket(store, {
    id: "tt_ended",
    editionId: "ed1",
    venueId: null,
    name: "Cerrada",
    description: null,
    code: "END",
    priceAmount: 1000,
    currency: "ARS",
    capacity: 10,
    holdMinutes: 20,
    isActive: true,
    salesStartAt: new Date(now - 86_400_000 * 2),
    salesEndAt: new Date(now - 1000),
    products: [],
  });
  seedPublicTicket(store, {
    id: "tt_inactive",
    editionId: "ed1",
    venueId: null,
    name: "Inactiva",
    description: null,
    code: "OFF",
    priceAmount: 1000,
    currency: "ARS",
    capacity: 10,
    holdMinutes: 20,
    isActive: false,
    salesStartAt: null,
    salesEndAt: null,
    products: [],
  });

  const repo = createInMemoryPublicRegistrationRepository(store);
  const svc = createPublicRegistrationService({ repo });
  setPublicRegistrationServiceForTests(svc);

  // 1 edition missing
  const missing = await getPublicRegistrationContextAction("no-existe");
  assert(missing.ok === false && missing.code === "EDITION_NOT_AVAILABLE", "1 missing edition");

  // unpublished
  store.editions.get("ed1")!.isPublished = false;
  const unpub = await getPublicRegistrationContextAction("cordoba-2026");
  assert(unpub.ok === false, "2 unpublished");
  store.editions.get("ed1")!.isPublished = true;

  const ctx = await getPublicRegistrationContextAction("cordoba-2026");
  assert(ctx.ok && ctx.data?.tickets.some((t) => t.id === "tt_paid"), "9 context tickets");
  assert((ctx.data?.tickets.length ?? 0) >= 1, "tickets listed");

  // invalid venue other edition
  const badVenue = await svc.createRegistration({
    editionSlug: "cordoba-2026",
    venueId: "vn_other",
    ticketTypeId: "tt_free",
    variantChoices: [],
    participant: {
      firstName: "Ana",
      lastName: "Pérez",
      email: "venue@example.com",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: false,
    idempotencyKey: "idem_venue_bad",
  }).then(
    () => null,
    (e: Error & { code?: string }) => e,
  );
  // tt_free forces venueId from ticket → ok path; test other edition venue with paid
  const badVenue2 = await svc
    .createRegistration({
      editionSlug: "cordoba-2026",
      venueId: "vn_other",
      ticketTypeId: "tt_paid",
      variantChoices: [{ productId: "prod_tee", productVariantId: "var_m" }],
      participant: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "venue2@example.com",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: false,
      idempotencyKey: "idem_venue_bad2",
    })
    .then(
      () => null,
      (e: { code?: string }) => e,
    );
  assert(badVenue2 && badVenue2.code === "VENUE_NOT_AVAILABLE", "4 venue other edition");
  void badVenue;

  // inactive ticket
  await svc
    .createRegistration({
      editionSlug: "cordoba-2026",
      venueId: "vn1",
      ticketTypeId: "tt_inactive",
      variantChoices: [],
      participant: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "ina@example.com",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: false,
      idempotencyKey: "idem_ina",
    })
    .then(
      () => assert(false, "5 inactive should fail"),
      (e: { code?: string }) => assert(e.code === "TICKET_NOT_AVAILABLE" || e.code === "SALE_ENDED", "5 inactive"),
    );

  // sale future / ended
  await svc
    .createRegistration({
      editionSlug: "cordoba-2026",
      venueId: null,
      ticketTypeId: "tt_future",
      variantChoices: [],
      participant: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "fut@example.com",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: false,
      idempotencyKey: "idem_fut",
    })
    .then(
      () => assert(false, "7 future"),
      (e: { code?: string }) => assert(e.code === "SALE_NOT_STARTED", "7 future code"),
    );

  await svc
    .createRegistration({
      editionSlug: "cordoba-2026",
      venueId: null,
      ticketTypeId: "tt_ended",
      variantChoices: [],
      participant: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "end@example.com",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: false,
      idempotencyKey: "idem_end",
    })
    .then(
      () => assert(false, "8 ended"),
      (e: { code?: string }) => assert(e.code === "SALE_ENDED", "8 ended code"),
    );

  // consent
  const noConsent = await createPublicRegistrationAction(
    undefined,
    form({
      editionSlug: "cordoba-2026",
      venueId: "vn1",
      ticketTypeId: "tt_free",
      variantChoices: "[]",
      idempotencyKey: "idem_noconsent",
      ...baseParticipant({ email: "noc@example.com" }),
      acceptTerms: "",
      acceptPrivacy: "",
    }),
  );
  assert(noConsent.ok === false && noConsent.code === "CONSENT_REQUIRED", "26 consent");

  // variant required
  await svc
    .createRegistration({
      editionSlug: "cordoba-2026",
      venueId: null,
      ticketTypeId: "tt_paid",
      variantChoices: [],
      participant: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "var@example.com",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: true,
      idempotencyKey: "idem_var",
    })
    .then(
      () => assert(false, "15 variant required"),
      (e: { code?: string }) => assert(e.code === "VARIANT_REQUIRED", "15 code"),
    );

  // invalid variant
  await svc
    .createRegistration({
      editionSlug: "cordoba-2026",
      venueId: null,
      ticketTypeId: "tt_paid",
      variantChoices: [{ productId: "prod_tee", productVariantId: "nope" }],
      participant: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "badvar@example.com",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: false,
      idempotencyKey: "idem_badvar",
    })
    .then(
      () => assert(false, "16 invalid variant"),
      (e: { code?: string }) => assert(e.code === "INVALID_VARIANT", "16 code"),
    );

  // out of stock variant L
  await svc
    .createRegistration({
      editionSlug: "cordoba-2026",
      venueId: null,
      ticketTypeId: "tt_paid",
      variantChoices: [{ productId: "prod_tee", productVariantId: "var_l" }],
      participant: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "oos@example.com",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: false,
      idempotencyKey: "idem_oos",
    })
    .then(
      () => assert(false, "14 oos"),
      (e: { code?: string }) => assert(e.code === "PRODUCT_OUT_OF_STOCK", "14 code"),
    );

  const reservedBefore = store.variants.get("var_m")!.reservedStock;

  // happy path paid
  const created = await svc.createRegistration({
    editionSlug: "cordoba-2026",
    venueId: "vn1",
    ticketTypeId: "tt_paid",
    variantChoices: [{ productId: "prod_tee", productVariantId: "var_m" }],
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
    acceptImage: true,
    idempotencyKey: "idem_ok_1",
  });
  assert(created.status === "PENDING_PAYMENT", "19 status");
  assert(created.paymentStatus === "PENDING", "19 payment");
  assert(created.totalAmount === 4_000_000, "10 server price");
  assert(created.items[0]?.nameSnapshot.includes("Remera"), "17 snapshot");
  assert(created.holdExpiresAt != null, "20 hold expiry");
  assert(store.variants.get("var_m")!.reservedStock === reservedBefore + 1, "20 stock hold reserved");
  assert(store.variants.get("var_m")!.stock === 5, "34 stock not decremented");
  assert([...store.domain.capacityHolds.values()].some((h) => h.status === "ACTIVE"), "20 capacity hold");

  // free ticket
  const free = await svc.createRegistration({
    editionSlug: "cordoba-2026",
    venueId: "vn1",
    ticketTypeId: "tt_free",
    variantChoices: [],
    participant: {
      firstName: "Bob",
      lastName: "Free",
      email: "free@example.com",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: false,
    idempotencyKey: "idem_free",
  });
  assert(free.totalAmount === 0, "11 free");
  assert(free.paymentStatus === "NOT_REQUIRED", "11 not required");
  assert(free.status === "PENDING_PAYMENT", "11 still pending payment status lane");

  // idempotency same
  const again = await svc.createRegistration({
    editionSlug: "cordoba-2026",
    venueId: "vn1",
    ticketTypeId: "tt_paid",
    variantChoices: [{ productId: "prod_tee", productVariantId: "var_m" }],
    participant: {
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    idempotencyKey: "idem_ok_1",
  });
  assert(again.registrationId === created.registrationId, "22 idempotent");

  // idempotency conflict
  await svc
    .createRegistration({
      editionSlug: "cordoba-2026",
      venueId: "vn1",
      ticketTypeId: "tt_free",
      variantChoices: [],
      participant: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "other@example.com",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: false,
      idempotencyKey: "idem_ok_1",
    })
    .then(
      () => assert(false, "23 conflict"),
      (e: { code?: string }) => assert(e.code === "IDEMPOTENCY_CONFLICT", "23 code"),
    );

  // duplicate email active
  await svc
    .createRegistration({
      editionSlug: "cordoba-2026",
      venueId: "vn1",
      ticketTypeId: "tt_free",
      variantChoices: [],
      participant: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "ana@example.com",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: false,
      idempotencyKey: "idem_dup",
    })
    .then(
      () => assert(false, "duplicate"),
      (e: { code?: string }) => assert(e.code === "DUPLICATE_REGISTRATION", "dup code"),
    );

  // secure summary
  const summaryOk = await getPublicRegistrationSummaryAction(
    created.registrationId,
    created.accessToken,
    "cordoba-2026",
  );
  assert(summaryOk.ok && summaryOk.data?.participant.email === "ana@example.com", "28 summary");
  assert(verifyRegistrationAccessToken(created.registrationId, created.accessToken), "token");

  const summaryBad = await getPublicRegistrationSummaryAction(
    created.registrationId,
    "0.invalid",
    "cordoba-2026",
  );
  assert(summaryBad.ok === false && summaryBad.code === "FORBIDDEN", "28 idor");

  // concurrency last seat on capacity 2: already 1 paid hold; fill with one more then fail
  const r2 = await svc.createRegistration({
    editionSlug: "cordoba-2026",
    venueId: null,
    ticketTypeId: "tt_paid",
    variantChoices: [{ productId: "prod_tee", productVariantId: "var_m" }],
    participant: {
      firstName: "Cara",
      lastName: "Two",
      email: "cara@example.com",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: false,
    idempotencyKey: "idem_cara",
  });
  assert(r2.status === "PENDING_PAYMENT", "25 second seat");

  const [a, b] = await Promise.allSettled([
    svc.createRegistration({
      editionSlug: "cordoba-2026",
      venueId: null,
      ticketTypeId: "tt_paid",
      variantChoices: [{ productId: "prod_tee", productVariantId: "var_m" }],
      participant: {
        firstName: "X",
        lastName: "Y",
        email: "x1@example.com",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: false,
      idempotencyKey: "idem_race_a",
    }),
    svc.createRegistration({
      editionSlug: "cordoba-2026",
      venueId: null,
      ticketTypeId: "tt_paid",
      variantChoices: [{ productId: "prod_tee", productVariantId: "var_m" }],
      participant: {
        firstName: "X",
        lastName: "Z",
        email: "x2@example.com",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: false,
      idempotencyKey: "idem_race_b",
    }),
  ]);
  const wins = [a, b].filter((x) => x.status === "fulfilled").length;
  const fails = [a, b].filter((x) => x.status === "rejected").length;
  assert(wins === 0 && fails === 2, "25 both fail when full");

  // no Order entity references in prisma create path source
  const prismaRepo = file(
    "lib/public-registration/infrastructure/prisma-public-registration-repository.ts",
  );
  assert(!prismaRepo.includes("ClickatonOrder"), "35 no Order");
  assert(!prismaRepo.includes("stock: { decrement"), "34 no definitive stock decrement");

  assert(
    typeof missing.message === "string" && !missing.message.toLowerCase().includes("prisma"),
    "27 sanitized",
  );

  setPublicRegistrationServiceForTests(null);
  console.log("clickaton public-registration-reservation.selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
