/**
 * Selfcheck de dominio 10D2 — lógica in-memory (sin I/O a Neon).
 */
import {
  createInMemoryCatalogRepository,
  createInMemoryCheckInRepository,
  createInMemoryClickatonStore,
  createInMemoryCredentialRepository,
  createInMemoryKitDeliveryRepository,
  createInMemoryRegistrationRepository,
  hashToken,
} from "./in-memory";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`registration.domain.selfcheck: ${msg}`);
}

async function main() {
  const store = createInMemoryClickatonStore();
  const catalog = createInMemoryCatalogRepository(store);
  const regs = createInMemoryRegistrationRepository(store);
  const creds = createInMemoryCredentialRepository(store);
  const checkins = createInMemoryCheckInRepository(store);
  const kits = createInMemoryKitDeliveryRepository(store);

  store.ticketTypes.set("tt_shirt", {
    id: "tt_shirt",
    editionId: "ed1",
    venueId: "vn1",
    code: "ENTRY_SHIRT",
    priceAmount: 15000_00,
    currency: "ARS",
    capacity: 100,
    holdMinutes: 20,
    isActive: true,
  });
  store.variants.set("var_m", {
    id: "var_m",
    productId: "prod_shirt",
    code: "M",
    name: "Remera M",
    sku: "SHIRT-M",
    stock: 10,
    reservedStock: 0,
    priceAmount: null,
    currency: null,
    isActive: true,
  });

  // 1. draft
  const draft = await regs.createDraft({
    editionId: "ed1",
    userId: 1,
    ticket: {
      ticketTypeId: "tt_shirt",
      venueId: "vn1",
      variantChoices: [{ productId: "prod_shirt", productVariantId: "var_m" }],
    },
    participant: {
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "+54911",
      country: "AR",
      acceptedTermsAt: new Date(),
      acceptedImageAt: new Date(),
    },
    currency: "ARS",
    subtotalAmount: 15000_00,
    discountAmount: 0,
    totalAmount: 15000_00,
    items: [
      {
        productId: "prod_shirt",
        productVariantId: "var_m",
        nameSnapshot: "Remera M",
        skuSnapshot: "SHIRT-M",
        quantity: 1,
        unitPriceAmount: 0,
        totalPriceAmount: 0,
        currency: "ARS",
        isIncluded: true,
      },
    ],
  });
  assert(draft.status === "DRAFT", "1 draft status");
  assert(draft.paymentStatus === "PENDING", "1 payment pending for paid ticket");

  // 2. price snapshot
  assert(draft.money.totalAmount === 15000_00, "2 price snapshot");
  assert(Number.isInteger(draft.money.totalAmount), "2 integer minor units");
  const tt = await catalog.getTicketType("tt_shirt");
  assert(tt?.priceAmount === draft.money.subtotalAmount, "2 ticket price frozen");

  // 3. entrada con remera
  assert(draft.items.length === 1 && draft.items[0]?.isIncluded, "3 shirt included");
  assert(draft.items[0]?.skuSnapshot === "SHIRT-M", "3 sku snapshot");

  // 4. capacity hold
  const expires = new Date(Date.now() + 20 * 60_000);
  const ch = await regs.createCapacityHold({
    registrationId: draft.id,
    editionId: "ed1",
    venueId: "vn1",
    ticketTypeId: "tt_shirt",
    expiresAt: expires,
  });
  assert(ch.status === "ACTIVE", "4 capacity hold active");

  // 5. stock hold
  const sh = await regs.createStockHold({
    registrationId: draft.id,
    productVariantId: "var_m",
    quantity: 1,
    expiresAt: expires,
  });
  assert(sh.status === "ACTIVE", "5 stock hold active");
  assert(store.variants.get("var_m")?.reservedStock === 1, "5 reserved stock");

  // 6. visible code unique via sequence (not count+1 race)
  const confirmed = await regs.confirm({
    registrationId: draft.id,
    paymentStatus: "APPROVED",
    assignVisibleCode: true,
    editionPrefix: "COR26",
    source: "payments_webhook",
    requestId: "req-1",
  });
  assert(confirmed.status === "CONFIRMED", "6 confirmed");
  assert(confirmed.visibleCode === "COR26-00001", "6 visible code");
  assert(confirmed.sequenceNumber === 1, "6 sequence");

  const draft2 = await regs.createDraft({
    editionId: "ed1",
    userId: 2,
    ticket: { ticketTypeId: "tt_shirt", venueId: "vn1" },
    participant: {
      firstName: "Bob",
      lastName: "Gómez",
      email: "bob@example.com",
      country: "AR",
    },
    currency: "ARS",
    subtotalAmount: 10000_00,
    discountAmount: 0,
    totalAmount: 10000_00,
    items: [],
  });
  const confirmed2 = await regs.confirm({
    registrationId: draft2.id,
    paymentStatus: "APPROVED",
    assignVisibleCode: true,
    editionPrefix: "COR26",
    source: "payments_webhook",
  });
  assert(confirmed2.visibleCode === "COR26-00002", "6 second code");
  const codes = await regs.listVisibleCodes("ed1");
  assert(new Set(codes).size === codes.length, "6 unique codes");

  // 7. QR stored as hash
  const cred = await creds.issueCredential({
    registrationId: confirmed.id,
    publicCode: confirmed.visibleCode!,
  });
  const qr = await creds.issueQrToken({ credentialId: cred.id, entropyBytes: 32 });
  assert(qr.plaintextToken.length >= 32, "7 plaintext issued once");
  assert(qr.tokenHash === hashToken(qr.plaintextToken), "7 hash matches");
  const stored = await creds.getStoredTokenMaterial(cred.id);
  assert(stored?.plaintextStored === false, "7 no plaintext stored");
  assert(stored?.tokenHash === qr.tokenHash, "7 hash persisted");
  assert(!JSON.stringify(stored).includes(qr.plaintextToken), "7 plaintext absent from store");

  // 8. check-in idempotent
  const ci1 = await checkins.perform({
    registrationId: confirmed.id,
    credentialId: cred.id,
    venueId: "vn1",
    operatorUserId: 99,
    source: "QR_SCAN",
    requestId: "ci-req-1",
  });
  const ci1b = await checkins.perform({
    registrationId: confirmed.id,
    credentialId: cred.id,
    venueId: "vn1",
    operatorUserId: 99,
    source: "QR_SCAN",
    requestId: "ci-req-1",
  });
  assert(ci1.id === ci1b.id, "8 idempotent check-in");

  // 9. reject double check-in
  let doubleRejected = false;
  try {
    await checkins.perform({
      registrationId: confirmed.id,
      credentialId: cred.id,
      operatorUserId: 99,
      source: "MANUAL_SEARCH",
      requestId: "ci-req-2",
    });
  } catch (e) {
    doubleRejected = e instanceof Error && e.message === "already_checked_in";
  }
  assert(doubleRejected, "9 double check-in rejected");

  // 10. kit delivery separate from check-in
  const kit = await kits.deliver({
    registrationId: confirmed.id,
    venueId: "vn1",
    operatorUserId: 88,
    status: "DELIVERED",
    requestId: "kit-1",
    items: [
      {
        registrationItemId: confirmed.items[0]!.id,
        quantityDelivered: 1,
      },
    ],
  });
  assert(kit.status === "DELIVERED", "10 kit delivered");
  const stillCheckedIn = await checkins.getActiveByRegistration(confirmed.id);
  assert(stillCheckedIn?.id === ci1.id, "10 check-in unchanged by kit");
  assert(confirmed.status === "CONFIRMED", "10 commercial status untouched");

  // 11. audited reversal
  const reversed = await checkins.reverse({
    checkInId: ci1.id,
    reversedByUserId: 77,
    reversalReason: "error de operador",
    requestId: "rev-1",
  });
  assert(reversed.reversedAt != null, "11 reversed");
  assert(
    store.audits.some((a) => a.action === "checkin.reverse" && a.actorUserId === 77),
    "11 audit trail",
  );

  // 12. payment vs registration statuses separated
  const courtesy = await regs.createDraft({
    editionId: "ed1",
    userId: 3,
    ticket: { ticketTypeId: "tt_shirt" },
    participant: {
      firstName: "Cortesía",
      lastName: "X",
      email: "c@example.com",
      country: "AR",
    },
    currency: "ARS",
    subtotalAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    items: [],
  });
  assert(courtesy.paymentStatus === "NOT_REQUIRED", "12 free NOT_REQUIRED");
  await regs.transition({
    registrationId: courtesy.id,
    newStatus: "PENDING_PAYMENT",
    newPaymentStatus: "PROCESSING",
    source: "test",
  });
  const mid = await regs.getById(courtesy.id);
  assert(mid?.status === "PENDING_PAYMENT" && mid.paymentStatus === "PROCESSING", "12 dual fields");
  assert(mid.status !== ("CHECKED_IN" as string), "12 no check-in in commercial status");

  console.log("clickaton registration domain.selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
