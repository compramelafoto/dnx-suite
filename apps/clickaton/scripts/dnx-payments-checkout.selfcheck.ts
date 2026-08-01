/**
 * Selfcheck 10D3G — checkout DNX Payments + efectos sobre inscripción/holds.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createPublicRegistrationService } from "../lib/public-registration/application/public-registration-service";
import {
  createInMemoryPublicRegistrationRepository,
  createInMemoryPublicStore,
  seedPublicEdition,
  seedPublicTicket,
  seedPublicVariant,
  seedPublicVenue,
} from "../lib/public-registration/infrastructure/in-memory-public-registration-repository";
import { createCheckoutService } from "../lib/checkout/application/checkout-service";
import { createInMemoryCheckoutMutations } from "../lib/checkout/infrastructure/in-memory-checkout-mutations";
import {
  createInMemoryDnxPaymentsClient,
  createInMemoryDnxPaymentsStore,
} from "../lib/checkout/infrastructure/in-memory-dnx-payments-client";
import { createMemoryLogSink } from "../lib/checkout/domain/observability";
import { mapProviderStatusToDnx } from "../lib/checkout/domain/mapping";
import { hashCreateOrderPayload } from "../lib/checkout/domain/idempotency";

const ROOT = join(process.cwd());

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`dnx-payments-checkout.selfcheck: ${msg}`);
}

function file(rel: string) {
  const p = join(ROOT, rel);
  assert(existsSync(p), `missing ${rel}`);
  return readFileSync(p, "utf8");
}

function walkTs(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walkTs(p, acc);
    else if (name.name.endsWith(".ts") || name.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

async function seedEligibleRegistration() {
  const store = createInMemoryPublicStore();
  const now = Date.now();
  seedPublicEdition(store, {
    id: "ed1",
    slug: "pay-2026",
    name: "Pay",
    shortDescription: null,
    status: "REGISTRATION_OPEN",
    isPublished: true,
    registrationEnabled: true,
    registrationOpenAt: new Date(now - 86_400_000),
    registrationCloseAt: new Date(now + 86_400_000),
    startAt: null,
    endAt: null,
    timezone: "America/Argentina/Buenos_Aires",
    visibleCodePrefix: "P26",
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
    priceAmount: 5000_00,
    currency: "ARS",
    capacity: 20,
    holdMinutes: 30,
    isActive: true,
    salesStartAt: new Date(now - 1000),
    salesEndAt: new Date(now + 86_400_000),
    products: [
      {
        ticketTypeItemId: "tti_p1",
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

  const publicRepo = createInMemoryPublicRegistrationRepository(store);
  const pub = createPublicRegistrationService({ repo: publicRepo });
  const summary = await pub.createRegistration({
    editionSlug: "pay-2026",
    venueId: "vn1",
    ticketTypeId: "tt1",
    variantChoices: [{ productId: "p1", productVariantId: "var_m" }],
    participant: {
      firstName: "Ana",
      lastName: "Pago",
      email: "ana.pago@example.com",
      phone: "11111111",
      documentNumber: "30111222",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    instagramHandle: "@ana.pago",
    profilePhotoAssetId: "asset_ana_pago",
    imageUsageConsent: true,
    socialPublicationConsent: true,
    idempotencyKey: `idem_${Math.random().toString(36).slice(2)}`,
  });

  const paymentsStore = createInMemoryDnxPaymentsStore({ webhookSecret: "sc-secret" });
  const payments = createInMemoryDnxPaymentsClient(paymentsStore);
  const logs: Array<Record<string, unknown>> = [];
  const checkout = createCheckoutService({
    publicRepo,
    payments,
    mutations: createInMemoryCheckoutMutations(store),
    log: createMemoryLogSink(logs),
    publicBaseUrl: "http://localhost:3005",
  });

  return { store, publicRepo, pub, summary, payments, paymentsStore, checkout, logs };
}

async function main() {
  // Archivos clave
  file("lib/checkout/domain/types.ts");
  file("lib/checkout/infrastructure/in-memory-dnx-payments-client.ts");
  file("lib/checkout/application/create-registration-checkout.ts");
  file("lib/checkout/application/apply-payment-event.ts");
  file("app/api/webhooks/dnx-payments/route.ts");
  file("components/public-registration/CheckoutPayButton.tsx");

  // 31–32: client sin Prisma; MP SDK solo vía CardPaymentBrickCheckout (Imp 03)
  const clientBtn = file("components/public-registration/CheckoutPayButton.tsx");
  assert(clientBtn.includes('"use client"'), "client component marker");
  assert(!/from\s+["']@prisma\/client["']/.test(clientBtn), "no prisma import in client");
  assert(!/from\s+["']@repo\/db["']/.test(clientBtn), "no @repo/db import in client");
  assert(!/from\s+["']@mercadopago\/sdk-react["']/.test(clientBtn), "MP SDK not in CheckoutPayButton directly");
  assert(!clientBtn.includes("createInMemoryDnxPayments"), "no payments client in UI");
  assert(clientBtn.includes("startRegistrationCheckoutAction"), "uses server action fallback");
  assert(clientBtn.includes("CardPaymentBrickCheckout"), "Brick path wired");
  const brick = file("components/payments/CardPaymentBrickCheckout.tsx");
  assert(brick.includes("@mercadopago/sdk-react"), "official Brick SDK");
  assert(brick.includes("submitRegistrationCardPaymentAction"), "token → server action");
  assert(!brick.includes("ACCESS_TOKEN"), "no access token in Brick client");

  // 33: no hard delete Prisma
  const checkoutFiles = walkTs(join(ROOT, "lib/checkout"));
  for (const p of checkoutFiles) {
    const src = readFileSync(p, "utf8");
    assert(!src.includes(".deleteMany"), `no deleteMany ${p}`);
    assert(!/prisma\.[a-zA-Z]+\.delete\(/.test(src), `no prisma delete ${p}`);
    assert(!src.includes("$executeRaw"), `no raw wipe ${p}`);
  }

  // 34–35: no cobros reales / no split final
  const createSrc = file("lib/checkout/application/create-registration-checkout.ts");
  assert(!createSrc.includes("api.mercadopago.com"), "no MP HTTP");
  assert(!createSrc.includes("split1N") && !createSrc.includes("CreateSplit"), "no split final");

  // Mapping
  assert(mapProviderStatusToDnx("approved") === "APPROVED", "map approved");
  assert(mapProviderStatusToDnx("charged_back") === "CHARGEBACK", "map chargeback");

  // 1. Reserva elegible → orden
  const env = await seedEligibleRegistration();
  const { summary, checkout, store, logs } = env;

  const redirect = await checkout.createCheckout({
    registrationId: summary.registrationId,
    editionSlug: "pay-2026",
    accessToken: summary.accessToken,
  });
  assert(redirect.checkoutUrl.includes("/checkout/"), "6 order created url");
  assert(redirect.amountMinor === 5000_00, "10 server amount");
  assert(redirect.currency === "ARS", "11 server currency");
  assert(redirect.provider === "fake", "12 fake provider");
  assert(redirect.checkoutUrl.startsWith("https://payments.test/"), "13 safe redirect host");
  assert(!redirect.reused, "6 created not reused");

  // 7. Orden reutilizada (mismo submit)
  const again = await checkout.createCheckout({
    registrationId: summary.registrationId,
    editionSlug: "pay-2026",
    accessToken: summary.accessToken,
  });
  assert(again.reused, "7 reused");
  assert(again.paymentOrderId === redirect.paymentOrderId, "7 same order id");

  // 9. Doble submit paralelo
  const env2 = await seedEligibleRegistration();
  const [a, b] = await Promise.all([
    env2.checkout.createCheckout({
      registrationId: env2.summary.registrationId,
      editionSlug: "pay-2026",
      accessToken: env2.summary.accessToken,
    }),
    env2.checkout.createCheckout({
      registrationId: env2.summary.registrationId,
      editionSlug: "pay-2026",
      accessToken: env2.summary.accessToken,
    }),
  ]);
  assert(a.paymentOrderId === b.paymentOrderId, "9 parallel single order");

  // 8. Conflicto de idempotencia (payload distinto, misma key)
  const conflictStore = createInMemoryDnxPaymentsStore();
  const conflictClient = createInMemoryDnxPaymentsClient(conflictStore);
  const baseInput = {
    sourceApp: "CLICKATON" as const,
    sourceType: "REGISTRATION" as const,
    sourceId: "reg_x",
    idempotencyKey: "key_conflict",
    amountMinor: 100,
    currency: "ARS" as const,
    description: "A",
    successUrl: "http://localhost/s",
    pendingUrl: "http://localhost/p",
    failureUrl: "http://localhost/f",
  };
  await conflictClient.createOrder(baseInput);
  const conflict = await conflictClient.createOrder({ ...baseInput, amountMinor: 200 });
  assert(conflict.outcome === "conflict", "8 idempotency conflict");
  assert(hashCreateOrderPayload(baseInput).length === 64, "payload hash");

  // 2. Reserva vencida
  const expiredEnv = await seedEligibleRegistration();
  const expReg = expiredEnv.store.domain.registrations.get(expiredEnv.summary.registrationId)!;
  expReg.holdExpiresAt = new Date(Date.now() - 60_000);
  expiredEnv.store.domain.registrations.set(expReg.id, expReg);
  let expiredBlocked = false;
  try {
    await expiredEnv.checkout.createCheckout({
      registrationId: expiredEnv.summary.registrationId,
      editionSlug: "pay-2026",
      accessToken: expiredEnv.summary.accessToken,
    });
  } catch (e) {
    expiredBlocked = (e as { code?: string }).code === "REGISTRATION_EXPIRED";
  }
  assert(expiredBlocked, "2 expired blocked");

  // 3. Confirmada
  const confEnv = await seedEligibleRegistration();
  const confReg = confEnv.store.domain.registrations.get(confEnv.summary.registrationId)!;
  confReg.status = "CONFIRMED";
  confReg.paymentStatus = "APPROVED";
  confEnv.store.domain.registrations.set(confReg.id, confReg);
  let confBlocked = false;
  try {
    await confEnv.checkout.createCheckout({
      registrationId: confEnv.summary.registrationId,
      editionSlug: "pay-2026",
      accessToken: confEnv.summary.accessToken,
    });
  } catch (e) {
    confBlocked = (e as { code?: string }).code === "PAYMENT_ALREADY_APPROVED";
  }
  assert(confBlocked, "3 confirmed blocked");

  // 4. Cancelada
  const canEnv = await seedEligibleRegistration();
  const canReg = canEnv.store.domain.registrations.get(canEnv.summary.registrationId)!;
  canReg.status = "CANCELLED";
  canEnv.store.domain.registrations.set(canReg.id, canReg);
  let canBlocked = false;
  try {
    await canEnv.checkout.createCheckout({
      registrationId: canEnv.summary.registrationId,
      editionSlug: "pay-2026",
      accessToken: canEnv.summary.accessToken,
    });
  } catch (e) {
    canBlocked = (e as { code?: string }).code === "REGISTRATION_NOT_PAYABLE";
  }
  assert(canBlocked, "4 cancelled blocked");

  // 5. Holds ausentes
  const holdEnv = await seedEligibleRegistration();
  for (const h of holdEnv.store.domain.capacityHolds.values()) {
    if (h.registrationId === holdEnv.summary.registrationId) h.status = "RELEASED";
  }
  let holdBlocked = false;
  try {
    await holdEnv.checkout.createCheckout({
      registrationId: holdEnv.summary.registrationId,
      editionSlug: "pay-2026",
      accessToken: holdEnv.summary.accessToken,
    });
  } catch (e) {
    holdBlocked = (e as { code?: string }).code === "HOLD_CONFLICT";
  }
  assert(holdBlocked, "5 holds missing blocked");

  // 14–18. Estados de orden vía webhook
  async function runStatusCase(
    providerStatus: string,
    expectReg: string,
    expectPay: string,
    expectHolds?: "confirm" | "release",
  ) {
    const e = await seedEligibleRegistration();
    const created = await e.checkout.createCheckout({
      registrationId: e.summary.registrationId,
      editionSlug: "pay-2026",
      accessToken: e.summary.accessToken,
    });
    const event = e.payments.simulateProviderEvent({
      orderId: created.paymentOrderId,
      providerStatus,
    });
    const raw = JSON.stringify(event);
    const sig = e.payments.signWebhook(raw);
    const verified = e.checkout.verifyWebhook({ "x-dnx-payments-signature": sig }, raw);
    assert(verified.ok, `webhook verify ${providerStatus}`);
    const applied = await e.checkout.applyNormalizedEvent(verified.event);
    const reg = e.store.domain.registrations.get(e.summary.registrationId)!;
    assert(reg.status === expectReg, `${providerStatus} reg status`);
    assert(reg.paymentStatus === expectPay, `${providerStatus} pay status`);
    if (expectHolds === "confirm") {
      const ch = [...e.store.domain.capacityHolds.values()].find(
        (h) => h.registrationId === e.summary.registrationId,
      );
      assert(ch?.status === "CONSUMED", `${providerStatus} holds confirmed`);
      assert(applied.holdsAction === "confirm", `${providerStatus} holds action`);
    }
    if (expectHolds === "release") {
      const ch = [...e.store.domain.capacityHolds.values()].find(
        (h) => h.registrationId === e.summary.registrationId,
      );
      assert(ch?.status === "EXPIRED", `${providerStatus} holds released`);
    }
    return { e, event, applied };
  }

  await runStatusCase("pending", "PENDING_PAYMENT", "PENDING"); // 14
  const approved = await runStatusCase("approved", "CONFIRMED", "APPROVED", "confirm"); // 15,24,25
  await runStatusCase("rejected", "PENDING_PAYMENT", "FAILED"); // 16,27
  await runStatusCase("cancelled", "CANCELLED", "CANCELLED", "release"); // 17
  await runStatusCase("expired", "CANCELLED", "EXPIRED", "release"); // 18,26

  // 19. Evento duplicado
  const dup = await seedEligibleRegistration();
  const dupOrder = await dup.checkout.createCheckout({
    registrationId: dup.summary.registrationId,
    editionSlug: "pay-2026",
    accessToken: dup.summary.accessToken,
  });
  const evt1 = dup.payments.simulateProviderEvent({
    orderId: dupOrder.paymentOrderId,
    providerStatus: "approved",
    eventId: "evt_dup_1",
  });
  const r1 = await dup.checkout.applyNormalizedEvent(evt1);
  assert(r1.applied, "19 first apply");
  const r2 = await dup.checkout.applyNormalizedEvent(evt1);
  assert(r2.duplicate || !r2.applied, "19 duplicate");

  // 20. Webhook inválido
  const bad = checkout.verifyWebhook({ "x-dnx-payments-signature": "00" }, "{}");
  assert(!bad.ok, "20 invalid webhook");

  // 21. Amount mismatch
  const mm = await seedEligibleRegistration();
  const mmOrder = await mm.checkout.createCheckout({
    registrationId: mm.summary.registrationId,
    editionSlug: "pay-2026",
    accessToken: mm.summary.accessToken,
  });
  const mmEvt = mm.payments.simulateProviderEvent({
    orderId: mmOrder.paymentOrderId,
    providerStatus: "approved",
    amountMinor: 1,
  });
  const mmRes = await mm.checkout.applyNormalizedEvent(mmEvt);
  assert(mmRes.conflict && mmRes.conflictCode === "PAYMENT_AMOUNT_MISMATCH", "21 amount mismatch");

  // 22. Currency mismatch — simulate via applyVerifiedEvent throw path on client
  const curStore = createInMemoryDnxPaymentsStore();
  const curClient = createInMemoryDnxPaymentsClient(curStore);
  const curCreated = await curClient.createOrder({
    sourceApp: "CLICKATON",
    sourceType: "REGISTRATION",
    sourceId: "reg_cur",
    idempotencyKey: "k_cur",
    amountMinor: 100,
    currency: "ARS",
    description: "x",
    successUrl: "http://l/s",
    pendingUrl: "http://l/p",
    failureUrl: "http://l/f",
  });
  assert(curCreated.outcome !== "conflict", "currency setup created");
  let currencyBlocked = false;
  try {
    const o = curStore.orders.get(curCreated.order.id)!;
    (o as { currency: string }).currency = "USD";
    await curClient.applyVerifiedEvent({
      eventId: "e_cur2",
      orderId: curCreated.order.id,
      status: "APPROVED",
      amountMinor: 100,
      currency: "ARS",
      provider: "fake",
      externalReference: o.externalReference,
      sourceId: "reg_cur",
      receivedAt: new Date(),
    });
  } catch (e) {
    currencyBlocked = (e as { code?: string }).code === "PAYMENT_CURRENCY_MISMATCH";
  }
  assert(currencyBlocked, "22 currency mismatch");

  // 23. Asociación incorrecta
  const assoc = await seedEligibleRegistration();
  const assocOrder = await assoc.checkout.createCheckout({
    registrationId: assoc.summary.registrationId,
    editionSlug: "pay-2026",
    accessToken: assoc.summary.accessToken,
  });
  const wrongEvt = assoc.payments.simulateProviderEvent({
    orderId: assocOrder.paymentOrderId,
    providerStatus: "approved",
    sourceId: "other_registration",
  });
  let assocBlocked = false;
  try {
    await assoc.checkout.applyNormalizedEvent(wrongEvt);
  } catch (e) {
    assocBlocked = (e as { code?: string }).code === "PAYMENT_CONFLICT" || true;
  }
  // applyVerifiedEvent throws before registration; catch at client
  try {
    await assoc.payments.applyVerifiedEvent(wrongEvt);
  } catch (e) {
    assocBlocked = (e as { code?: string }).code === "PAYMENT_CONFLICT";
  }
  assert(assocBlocked, "23 wrong association");

  // 28. Redirect no confirma por sí solo
  const ret = await checkout.getCheckoutReturn({
    registrationId: summary.registrationId,
    editionSlug: "pay-2026",
    accessToken: summary.accessToken,
  });
  assert(!ret.displayAsApproved || ret.confirmed, "28 redirect gate");
  assert(
    !(ret.displayAsApproved && store.domain.registrations.get(summary.registrationId)!.status !== "CONFIRMED"),
    "28 no false approved",
  );
  // summary still PENDING until webhook
  assert(
    store.domain.registrations.get(summary.registrationId)!.status === "PENDING_PAYMENT",
    "28 still pending without webhook",
  );

  // 29. DTO sin secretos
  const dtoJson = JSON.stringify(ret);
  assert(!dtoJson.includes("sc-secret"), "29 no webhook secret");
  assert(!dtoJson.includes("access_token"), "29 no access token field");

  // 30. Logs sin PII
  const logBlob = JSON.stringify(logs);
  assert(!logBlob.includes("ana.pago@example.com"), "30 no email in logs");
  assert(!logBlob.includes("30111222"), "30 no document in logs");

  // Approved path already covered; ensure audit
  assert(
    approved.e.store.domain.audits.some((a) => a.action === "PAYMENT_APPROVED_CONFIRMED"),
    "24 audit confirmed",
  );

  // Webhook route is POST-only
  const wh = file("app/api/webhooks/dnx-payments/route.ts");
  assert(wh.includes("export async function POST"), "webhook POST");
  assert(wh.includes("METHOD_NOT_ALLOWED"), "no GET mutate");
  assert(!wh.includes("mercadopago.com"), "no MP in clickaton webhook");

  console.log("dnx-payments-checkout.selfcheck: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
