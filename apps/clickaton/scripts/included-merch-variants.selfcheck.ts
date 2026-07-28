/**
 * Etapa 4 — Remera incluida, variantes/talle, snapshots, fulfillment, export CSV.
 * In-memory (sin DB).
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { ARGENTINA_2026_SHIRT_SIZES } from "../config/editions/argentina-2026";
import {
  createAdminRegistrationAuthorization,
} from "../lib/admin-registration/auth/admin-registration-auth";
import { createAdminRegistrationService } from "../lib/admin-registration/application/registration-service";
import {
  createInMemoryAdminRegistrationRepository,
  createInMemoryAdminRegistrationStore,
  seedAdminRegistration,
} from "../lib/admin-registration/infrastructure/in-memory-registration-repository";
import {
  buildRegistrationsCsv,
  buildShirtSizeSummaryCsv,
  summarizeShirtSizes,
  toExportRowsFromList,
} from "../lib/admin-registration/export/registrations-csv";
import { buildItemsFromTicket } from "../lib/public-registration/application/public-registration-service";
import { PublicRegistrationError } from "../lib/public-registration/domain/errors";
import type { PublicTicketDto } from "../lib/public-registration/domain/types";
import { createPublicRegistrationService } from "../lib/public-registration/application/public-registration-service";
import {
  createInMemoryPublicRegistrationRepository,
  createInMemoryPublicStore,
  seedPublicEdition,
  seedPublicTicket,
  seedPublicVariant,
  seedPublicVenue,
} from "../lib/public-registration/infrastructure/in-memory-public-registration-repository";
import { AdminRegistrationForbiddenError } from "../lib/admin-registration/domain/errors";

function ticketBase(): PublicTicketDto {
  return {
    id: "tt1",
    name: "General",
    description: null,
    code: "GENERAL",
    priceAmount: 25_000_00,
    currency: "ARS",
    capacity: null,
    available: null,
    isUnlimited: true,
    isSoldOut: false,
    holdMinutes: 20,
    salesStartAt: new Date(Date.now() - 1000),
    salesEndAt: new Date(Date.now() + 86_400_000),
    salesStatus: "open",
    venueId: null,
    kitKind: "entry_product",
    products: [
      {
        ticketTypeItemId: "tti1",
        productId: "prod_remera",
        productName: "Remera Clickatón",
        quantity: 1,
        requiresVariantChoice: true,
        fixedVariant: null,
        variants: ARGENTINA_2026_SHIRT_SIZES.map((s, idx) => ({
          id: `var_${s.code}`,
          code: s.code,
          name: s.name,
          sku: `SKU-${s.code}`,
          availableStock: idx === 0 ? 0 : 100,
          isActive: s.code !== "XXXL",
          sortOrder: s.sortOrder,
        })),
      },
    ],
  };
}

async function main() {

const socialFields = {
  instagramHandle: "@ana.clickaton",
  profilePhotoAssetId: "asset_profile_test",
  imageUsageConsent: true,
  socialPublicationConsent: true,
} as const;


  const ticket = ticketBase();

  // 1) producto incluido
  assert.equal(ticket.products[0]!.productName, "Remera Clickatón");
  assert.equal(ticket.products[0]!.quantity, 1);
  assert.equal(ticket.products[0]!.requiresVariantChoice, true);

  // 2) selección obligatoria
  try {
    buildItemsFromTicket(ticket, []);
    assert.fail("should require variant");
  } catch (e) {
    assert.ok(e instanceof PublicRegistrationError);
    assert.equal(e.code, "VARIANT_REQUIRED");
  }

  // 3) talle válido
  const ok = buildItemsFromTicket(ticket, [
    { productId: "prod_remera", productVariantId: "var_M" },
  ]);
  assert.equal(ok[0]!.variantNameSnapshot, "M");
  assert.equal(ok[0]!.unitPriceAmount, 0);
  assert.equal(ok[0]!.isIncluded, true);
  assert.equal(ok[0]!.ticketTypeItemId, "tti1");
  assert.match(ok[0]!.nameSnapshot, /Remera Clickatón — M/);

  // 4) talle inexistente
  try {
    buildItemsFromTicket(ticket, [
      { productId: "prod_remera", productVariantId: "var_NOPE" },
    ]);
    assert.fail("invalid");
  } catch (e) {
    assert.ok(e instanceof PublicRegistrationError);
    assert.equal((e as PublicRegistrationError).code, "INVALID_VARIANT");
  }

  // 5) talle inactivo
  try {
    buildItemsFromTicket(ticket, [
      { productId: "prod_remera", productVariantId: "var_XXXL" },
    ]);
    assert.fail("inactive");
  } catch (e) {
    assert.ok(e instanceof PublicRegistrationError);
    assert.equal((e as PublicRegistrationError).code, "INVALID_VARIANT");
  }

  // 6) variante de otro producto
  try {
    buildItemsFromTicket(ticket, [
      { productId: "prod_remera", productVariantId: "var_OTHER" },
    ]);
    assert.fail("other product");
  } catch (e) {
    assert.ok(e instanceof PublicRegistrationError);
    assert.equal((e as PublicRegistrationError).code, "INVALID_VARIANT");
  }

  // 7) producto no incluido: se rechaza (no se confía en lista del frontend)
  const emptyTicket: PublicTicketDto = { ...ticket, products: [] };
  try {
    buildItemsFromTicket(emptyTicket, [
      { productId: "prod_remera", productVariantId: "var_M" },
    ]);
    assert.fail("foreign product should be rejected");
  } catch (e) {
    assert.ok(e instanceof PublicRegistrationError);
    assert.equal((e as PublicRegistrationError).code, "INVALID_VARIANT");
  }
  const none = buildItemsFromTicket(emptyTicket, []);
  assert.equal(none.length, 0);

  // 8) snapshot correcto (ya validado arriba)
  assert.equal(ok[0]!.skuSnapshot, "SKU-M");

  // 9–12) inscripción flow: sin talle falla; con talle PENDING conserva; confirm conserva; expire libera
  const now = Date.now();
  const store = createInMemoryPublicStore();
  seedPublicEdition(store, {
    id: "ed1",
    slug: "merch-2026",
    name: "Merch 2026",
    shortDescription: null,
    status: "REGISTRATION_OPEN",
    isPublished: true,
    registrationEnabled: true,
    registrationOpenAt: new Date(now - 1000),
    registrationCloseAt: new Date(now + 86_400_000),
    startAt: new Date(now + 86_400_000),
    endAt: new Date(now + 2 * 86_400_000),
    timezone: "America/Argentina/Buenos_Aires",
    visibleCodePrefix: "CK",
  });
  seedPublicVenue(store, {
    id: "vn1",
    editionId: "ed1",
    name: "Sede",
    city: null,
    province: null,
    address: null,
    startAt: null,
    isActive: true,
  });
  seedPublicVariant(store, {
    id: "var_M",
    productId: "prod_remera",
    name: "M",
    sku: "SKU-M",
    stock: 10,
    reservedStock: 0,
    isActive: true,
  });
  seedPublicTicket(store, {
    id: "tt1",
    editionId: "ed1",
    venueId: "vn1",
    name: "General",
    description: null,
    code: "GENERAL",
    priceAmount: 1000_00,
    currency: "ARS",
    capacity: 10,
    holdMinutes: 20,
    isActive: true,
    salesStartAt: new Date(now - 1000),
    salesEndAt: new Date(now + 86_400_000),
    products: [
      {
        ticketTypeItemId: "tti1",
        productId: "prod_remera",
        productName: "Remera Clickatón",
        quantity: 1,
        requiresVariantChoice: true,
        fixedVariant: null,
        variants: [
          {
            id: "var_M",
            code: "M",
            name: "M",
            sku: "SKU-M",
            availableStock: 10,
            isActive: true,
            sortOrder: 30,
          },
        ],
      },
    ],
  });

  const pub = createPublicRegistrationService({
    repo: createInMemoryPublicRegistrationRepository(store),
  });

  await assert.rejects(
    () =>
      pub.createRegistration({
        editionSlug: "merch-2026",
        venueId: "vn1",
        ticketTypeId: "tt1",
        variantChoices: [],
        participant: {
          firstName: "Ana",
          lastName: "Test",
          email: "ana-merch@example.com",
          phone: "1112345678",
          documentNumber: "30111111",
          country: "AR",
        },
        acceptTerms: true,
        acceptPrivacy: true,
        acceptImage: false,
        ...socialFields,
        idempotencyKey: "merch_no_size",
      }),
    (e: unknown) =>
      e instanceof PublicRegistrationError && e.code === "VARIANT_REQUIRED",
  );

  const pending = await pub.createRegistration({
    editionSlug: "merch-2026",
    venueId: "vn1",
    ticketTypeId: "tt1",
    variantChoices: [{ productId: "prod_remera", productVariantId: "var_M" }],
    participant: {
      firstName: "Ana",
      lastName: "Test",
      email: "ana-merch@example.com",
      phone: "1112345678",
      documentNumber: "30111111",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: false,
        ...socialFields,
    idempotencyKey: "merch_ok",
  });
  assert.equal(pending.status, "PENDING_PAYMENT");
  assert.ok(pending.items.some((i) => i.nameSnapshot.includes("M")));
  assert.equal(store.variants.get("var_M")!.reservedStock, 1);

  const domainRow = store.domain.registrations.get(pending.registrationId)!;
  assert.equal(domainRow.items[0]!.variantNameSnapshot, "M");
  assert.equal(domainRow.items[0]!.isIncluded, true);

  // confirm conserva selección
  domainRow.status = "CONFIRMED";
  domainRow.paymentStatus = "APPROVED";
  domainRow.confirmedAt = new Date();
  assert.equal(domainRow.items[0]!.variantNameSnapshot, "M");

  // expire libera (segunda inscripción)
  const pending2 = await pub.createRegistration({
    editionSlug: "merch-2026",
    venueId: "vn1",
    ticketTypeId: "tt1",
    variantChoices: [{ productId: "prod_remera", productVariantId: "var_M" }],
    participant: {
      firstName: "Bob",
      lastName: "Test",
      email: "bob-merch@example.com",
      phone: "2222345678",
      documentNumber: "30222222",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: false,
        ...socialFields,
    idempotencyKey: "merch_expire",
  });
  const row2 = store.domain.registrations.get(pending2.registrationId)!;
  row2.holdExpiresAt = new Date(now - 1000);
  for (const h of store.domain.capacityHolds.values()) {
    if (h.registrationId === pending2.registrationId) h.expiresAt = new Date(now - 1000);
  }
  for (const h of store.domain.stockHolds.values()) {
    if (h.registrationId === pending2.registrationId) h.expiresAt = new Date(now - 1000);
  }
  const reservedBefore = store.variants.get("var_M")!.reservedStock;
  await pub.expirePendingRegistrations({ now: new Date(now), limit: 10, dryRun: false });
  assert.ok(store.variants.get("var_M")!.reservedStock < reservedBefore);

  // 13–15) admin talle + entrega + auth
  const adminStore = createInMemoryAdminRegistrationStore();
  adminStore.ticketTypes.set("tt1", {
    id: "tt1",
    editionId: "ed1",
    venueId: "vn1",
    capacity: null,
    isActive: true,
  });
  const seeded = seedAdminRegistration(adminStore, {
    id: "reg_admin",
    editionId: "ed1",
    ticketTypeId: "tt1",
    userId: 1,
    firstName: "Ana",
    lastName: "Admin",
    email: "admin-merch@example.com",
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    items: [
      {
        id: "ri1",
        ticketTypeItemId: "tti1",
        productId: "prod_remera",
        productVariantId: "var_M",
        nameSnapshot: "Remera Clickatón — M",
        variantNameSnapshot: "M",
        skuSnapshot: "SKU-M",
        quantity: 1,
        unitPriceAmount: 0,
        totalPriceAmount: 0,
        currency: "ARS",
        isIncluded: true,
        fulfillmentStatus: "PENDING",
        fulfilledAt: null,
        fulfilledByUserId: null,
      },
    ],
  });
  const adminSvc = createAdminRegistrationService({
    repo: createInMemoryAdminRegistrationRepository(adminStore),
    auth: createAdminRegistrationAuthorization(),
  });
  const actor = { userId: 99, email: "super@dnx.local", globalRole: "SUPER_ADMIN" };
  const listed = await adminSvc.listRegistrations(actor, {
    editionId: "ed1",
    shirtSize: "M",
  });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]!.shirtSizeLabel, "M");

  const delivered = await adminSvc.updateItemFulfillment(actor, {
    registrationId: seeded.id,
    registrationItemId: "ri1",
    nextStatus: "DELIVERED",
  });
  assert.equal(delivered.items[0]!.fulfillmentStatus, "DELIVERED");
  assert.ok(delivered.items[0]!.fulfilledAt);
  assert.equal(delivered.items[0]!.fulfilledByUserId, 99);
  assert.ok(delivered.audits.some((a) => a.action === "ITEM_FULFILLMENT_UPDATED"));

  await assert.rejects(
    () =>
      adminSvc.updateItemFulfillment(
        { userId: 1, email: "nope@example.com", globalRole: "USER" },
        {
          registrationId: seeded.id,
          registrationItemId: "ri1",
          nextStatus: "PENDING",
          reason: "error operativo",
        },
      ),
    (e: unknown) => e instanceof AdminRegistrationForbiddenError,
  );

  // 16) seed talles canónicos (config idempotente conceptual)
  assert.equal(ARGENTINA_2026_SHIRT_SIZES.length, 7);
  assert.deepEqual(
    ARGENTINA_2026_SHIRT_SIZES.map((s) => s.code),
    ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  );

  // 17–18) export CSV + resumen
  const exportRows = toExportRowsFromList(listed);
  const csv = buildRegistrationsCsv(exportRows);
  assert.match(csv, /shirtSize/);
  assert.match(csv, /,M,/);
  const summary = summarizeShirtSizes(exportRows, ARGENTINA_2026_SHIRT_SIZES.map((s) => s.code));
  assert.equal(summary.M, 1);
  const summaryCsv = buildShirtSizeSummaryCsv(
    summary,
    ARGENTINA_2026_SHIRT_SIZES.map((s) => s.code),
  );
  assert.match(summaryCsv, /M,1/);

  // stock 0 (XS) rechazado
  try {
    buildItemsFromTicket(ticket, [
      { productId: "prod_remera", productVariantId: "var_XS" },
    ]);
    assert.fail("oos");
  } catch (e) {
    assert.ok(e instanceof PublicRegistrationError);
    assert.equal((e as PublicRegistrationError).code, "PRODUCT_OUT_OF_STOCK");
  }

  console.log(JSON.stringify({ ok: true, checks: 18 }, null, 2));
}

const isMain =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
