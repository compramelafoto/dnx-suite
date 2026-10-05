import assert from "node:assert/strict";
import test from "node:test";

import type { AffiliateSplitCheckoutPort } from "@/lib/affiliates/infrastructure/affiliate-split-checkout";
import { createPublicRegistrationService } from "@/lib/public-registration/application/public-registration-service";
import {
  createInMemoryPublicRegistrationRepository,
  createInMemoryPublicStore,
  seedPublicEdition,
  seedPublicTicket,
  seedPublicVenue,
} from "@/lib/public-registration/infrastructure/in-memory-public-registration-repository";
import { createCheckoutRegistrationPort } from "../domain/checkout-registration-port";
import { CheckoutError } from "../domain/errors";
import type { CreatePaymentOrderInput, PaymentOrder } from "../domain/types";
import type { DnxPaymentsClient } from "../infrastructure/dnx-payments-client";
import { createInMemoryCheckoutMutations } from "../infrastructure/in-memory-checkout-mutations";
import {
  createRegistrationCheckoutUseCase,
  splitCheckoutIdempotencyKey,
  type AffiliateSplitCheckoutDeps,
} from "./create-registration-checkout";

const RECEIVER = "3f8a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b";
const CARD = {
  token: "card_tok_abc",
  paymentMethodId: "visa",
  installments: 1,
  deviceSessionId: "armor.device",
  payer: { email: "browser@example.com" },
};

async function seed() {
  const store = createInMemoryPublicStore();
  const now = Date.now();
  seedPublicEdition(store, {
    id: "ed1",
    slug: "split-2026",
    name: "Split",
    shortDescription: null,
    status: "REGISTRATION_OPEN",
    isPublished: true,
    registrationEnabled: true,
    registrationOpenAt: new Date(now - 86_400_000),
    registrationCloseAt: new Date(now + 86_400_000),
    startAt: null,
    endAt: null,
    timezone: "America/Argentina/Buenos_Aires",
    visibleCodePrefix: "S26",
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
  seedPublicTicket(store, {
    id: "tt1",
    editionId: "ed1",
    venueId: null,
    name: "General",
    description: null,
    code: "G",
    priceAmount: 30_000_00,
    currency: "ARS",
    capacity: 20,
    holdMinutes: 30,
    isActive: true,
    salesStartAt: new Date(now - 1000),
    salesEndAt: new Date(now + 86_400_000),
    products: [],
  });
  const publicRepo = createInMemoryPublicRegistrationRepository(store);
  const pub = createPublicRegistrationService({ repo: publicRepo });
  const summary = await pub.createRegistration({
    editionSlug: "split-2026",
    venueId: "vn1",
    ticketTypeId: "tt1",
    variantChoices: [],
    participant: {
      firstName: "Ana",
      lastName: "Split",
      email: "ana.split@example.com",
      birthDate: "1990-04-12",
      phone: "11111111",
      documentNumber: "30111222",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    instagramHandle: "@ana.split",
    profilePhotoAssetId: "asset_ana_split",
    imageUsageConsent: true,
    socialPublicationConsent: true,
    idempotencyKey: `idem_${Math.random().toString(36).slice(2)}`,
  });
  const registrationPort = createCheckoutRegistrationPort({
    publicRepo,
    mutations: createInMemoryCheckoutMutations(store),
  });
  return { publicRepo, registrationPort, summary };
}

function capturingPayments(providerOrderId: string, status: PaymentOrder["status"] = "APPROVED") {
  const inputs: CreatePaymentOrderInput[] = [];
  const payments = {
    async createOrder(input: CreatePaymentOrderInput) {
      inputs.push(input);
      const now = new Date();
      const order: PaymentOrder = {
        id: "dnx_ord_test",
        provider: "mercadopago_preferences_legacy",
        status,
        amountMinor: input.amountMinor,
        currency: "ARS",
        externalReference: `clickaton-registration-${input.sourceId}`,
        // Orders devuelve nuestra propia página de resultado; Checkout Pro, MP.
        checkoutUrl: input.affiliateSplit ? input.successUrl : "https://payments.test/x",
        sourceApp: "CLICKATON",
        sourceType: "REGISTRATION",
        sourceId: input.sourceId,
        idempotencyKey: input.idempotencyKey,
        payloadHash: "h",
        attempt: 1,
        statusDetail: "accredited",
        providerOrderId,
        createdAt: now,
        updatedAt: now,
        approvedAt: null,
        lastEventId: null,
        lastEventAt: null,
      };
      return { outcome: "created" as const, order };
    },
  } as unknown as DnxPaymentsClient;
  return { payments, inputs };
}

function fakePort(
  overrides: Partial<{ status: string; netAmount: number; receiver: boolean }> = {},
) {
  const marks: Array<[string, string]> = [];
  const port: AffiliateSplitCheckoutPort = {
    async loadCommission() {
      // $30.000 de lista, 10% de comisión, MP 6% → neto $2.820.
      return {
        affiliateId: "aff_1",
        status: overrides.status ?? "PENDING",
        mode: null,
        baseAmount: 30_000_00,
        commissionBps: 1000,
        mpFeeBps: 600,
        netAmount: overrides.netAmount ?? 2_820_00,
      };
    },
    async getActiveReceiver() {
      return overrides.receiver === false ? null : { receiverId: RECEIVER, recipientId: "rcp_aff_1" };
    },
    async markSplit(registrationId, providerOrderId) {
      marks.push([registrationId, providerOrderId]);
      return true;
    },
  };
  return { port, marks };
}

function splitDeps(active: boolean, port: AffiliateSplitCheckoutPort): AffiliateSplitCheckoutDeps {
  return { isActive: () => active, getPort: async () => port, expectedCollectorPaymentAccountId: null };
}

test("con el interruptor apagado el pedido de cobro no cambia", async () => {
  const { publicRepo, registrationPort, summary } = await seed();
  const { payments, inputs } = capturingPayments("ORD01X");
  const { port, marks } = fakePort();
  let portRequested = false;
  const useCase = createRegistrationCheckoutUseCase({
    publicRepo,
    payments,
    registrationPort,
    affiliateSplit: {
      isActive: () => false,
      getPort: async () => {
        portRequested = true;
        return port;
      },
    },
  });
  await useCase.execute({
    registrationId: summary.registrationId,
    editionSlug: "split-2026",
    accessToken: summary.accessToken,
    publicBaseUrl: "https://clickaton.test",
    cardPayment: CARD,
  });
  assert.equal(portRequested, false);
  assert.equal("affiliateSplit" in inputs[0]!, false);
  assert.match(inputs[0]!.idempotencyKey, /:a\d$/);
  assert.deepEqual(marks, []);
});

test("encendido + comisión repartible: pasa el reparto y marca la comisión SPLIT", async () => {
  const { publicRepo, registrationPort, summary } = await seed();
  const { payments, inputs } = capturingPayments("ORD01SPLIT");
  const { port, marks } = fakePort();
  const useCase = createRegistrationCheckoutUseCase({
    publicRepo,
    payments,
    registrationPort,
    affiliateSplit: splitDeps(true, port),
  });
  const out = await useCase.execute({
    registrationId: summary.registrationId,
    editionSlug: "split-2026",
    accessToken: summary.accessToken,
    publicBaseUrl: "https://clickaton.test",
    cardPayment: CARD,
  });
  const sent = inputs[0]!;
  assert.deepEqual(sent.affiliateSplit, {
    recipientId: "rcp_aff_1",
    receiverId: RECEIVER,
    partnerAmountMinor: 2_820_00,
  });
  assert.equal(sent.amountMinor, 30_000_00);
  // Email del pagador: siempre el del participante, nunca el del navegador.
  assert.equal(sent.cardPayment?.payer.email, "ana.split@example.com");
  assert.ok(sent.idempotencyKey.includes(":split:"));
  assert.equal(
    sent.idempotencyKey,
    splitCheckoutIdempotencyKey(sent.idempotencyKey.split(":split:")[0]!, CARD.token),
  );
  assert.equal(sent.idempotencyKey.includes(CARD.token), false);
  assert.deepEqual(marks, [[summary.registrationId, "ORD01SPLIT"]]);
  assert.equal(out.status, "APPROVED");
});

test("un rechazo no marca la comisión SPLIT", async () => {
  const { publicRepo, registrationPort, summary } = await seed();
  const { payments } = capturingPayments("ORD01REJ", "REJECTED");
  const { port, marks } = fakePort();
  const useCase = createRegistrationCheckoutUseCase({
    publicRepo,
    payments,
    registrationPort,
    affiliateSplit: splitDeps(true, port),
  });
  await useCase.execute({
    registrationId: summary.registrationId,
    editionSlug: "split-2026",
    accessToken: summary.accessToken,
    publicBaseUrl: "https://clickaton.test",
    cardPayment: CARD,
  });
  assert.deepEqual(marks, []);
});

test("encendido pero sin receptor activo: no cobra con tarjeta", async () => {
  const { publicRepo, registrationPort, summary } = await seed();
  const { payments, inputs } = capturingPayments("ORD01NO");
  const { port } = fakePort({ receiver: false });
  const useCase = createRegistrationCheckoutUseCase({
    publicRepo,
    payments,
    registrationPort,
    affiliateSplit: splitDeps(true, port),
  });
  await assert.rejects(
    useCase.execute({
      registrationId: summary.registrationId,
      editionSlug: "split-2026",
      accessToken: summary.accessToken,
      publicBaseUrl: "https://clickaton.test",
      cardPayment: CARD,
    }),
    (error: unknown) => error instanceof CheckoutError && error.code === "CHECKOUT_NOT_AVAILABLE",
  );
  assert.equal(inputs.length, 0);
});

test("encendido sin tarjeta (Checkout Pro): no consulta comisiones", async () => {
  const { publicRepo, registrationPort, summary } = await seed();
  const { payments, inputs } = capturingPayments("123456");
  let portRequested = false;
  const useCase = createRegistrationCheckoutUseCase({
    publicRepo,
    payments,
    registrationPort,
    affiliateSplit: {
      isActive: () => true,
      getPort: async () => {
        portRequested = true;
        return fakePort().port;
      },
    },
  });
  await useCase.execute({
    registrationId: summary.registrationId,
    editionSlug: "split-2026",
    accessToken: summary.accessToken,
    publicBaseUrl: "https://clickaton.test",
  });
  assert.equal(portRequested, false);
  assert.equal("affiliateSplit" in inputs[0]!, false);
});
