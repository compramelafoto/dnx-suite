/**
 * Selfcheck 10D3G-B — persistencia durable DNX Payments + efectos Clickatón.
 * Usa PostgreSQL local descartable (nunca Neon).
 */
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { userInfo } from "node:os";
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
import { createDurableDnxPaymentsClient } from "../lib/checkout/infrastructure/durable-dnx-payments-client";
import { createMemoryLogSink } from "../lib/checkout/domain/observability";
import { assertSafeCheckoutUrl } from "../lib/checkout/domain/checkout-url";
import {
  createInMemoryDnxPaymentsPersistence,
  createPrismaDnxPaymentsPersistence,
  type DnxPaymentsPrismaDelegates,
} from "@repo/payments/next";

const ROOT = join(process.cwd());

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`dnx-payments-persistence.selfcheck: ${msg}`);
}

function file(rel: string) {
  const p = join(ROOT, rel);
  assert(existsSync(p), `missing ${rel}`);
  return readFileSync(p, "utf8");
}

function sanitizeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid)";
  }
}

function assertLocalDatabaseUrl(url: string): void {
  const host = sanitizeHost(url).toLowerCase();
  if (
    host.includes("neon.tech") ||
    host.includes("amazonaws.com") ||
    host.includes("ep-")
  ) {
    console.error(`ABORT Neon/remoto: host=${sanitizeHost(url)}`);
    process.exit(2);
  }
  if (!host.includes("127.0.0.1") && !host.includes("localhost")) {
    console.error(`ABORT solo localhost: host=${sanitizeHost(url)}`);
    process.exit(2);
  }
}

function findFreeLocalPgPort(): number {
  // Prefer 5432 if accepting; else try common local ports.
  for (const port of [5432, 5433, 55432, 55434]) {
    try {
      execSync(`pg_isready -h 127.0.0.1 -p ${port}`, { stdio: "ignore" });
      return port;
    } catch {
      /* try next */
    }
  }
  throw new Error("No hay PostgreSQL local aceptando conexiones (pg_isready).");
}

function createDisposableDb(): { url: string; dbName: string; port: number; drop: () => void } {
  const port = findFreeLocalPgPort();
  const user = userInfo().username || "postgres";
  const dbName = `clickaton_10d3gb_${randomBytes(4).toString("hex")}`;
  assert(dbName !== "clickaton_10d3fb_tmp", "no fixed 10d3fb_tmp");
  const url = `postgresql://${user}@127.0.0.1:${port}/${dbName}?schema=public`;
  assertLocalDatabaseUrl(url);
  execSync(`createdb -h 127.0.0.1 -p ${port} ${dbName}`, { stdio: "ignore" });
  const drop = () => {
    try {
      execSync(`dropdb -h 127.0.0.1 -p ${port} --if-exists ${dbName}`, { stdio: "ignore" });
    } catch {
      /* best effort */
    }
  };
  return { url, dbName, port, drop };
}

async function seedRegistration() {
  const store = createInMemoryPublicStore();
  const now = Date.now();
  seedPublicEdition(store, {
    id: "ed1",
    slug: "persist-2026",
    name: "Persist",
    shortDescription: null,
    status: "REGISTRATION_OPEN",
    isPublished: true,
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
    priceAmount: 2500_00,
    currency: "ARS",
    capacity: 20,
    holdMinutes: 30,
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

  const publicRepo = createInMemoryPublicRegistrationRepository(store);
  const pub = createPublicRegistrationService({ repo: publicRepo });
  const summary = await pub.createRegistration({
    editionSlug: "persist-2026",
    venueId: "vn1",
    ticketTypeId: "tt1",
    variantChoices: [{ productId: "p1", productVariantId: "var_m" }],
    participant: {
      firstName: "Luis",
      lastName: "Durable",
      email: "luis.durable@example.com",
      phone: "11111111",
      documentNumber: "30999888",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    idempotencyKey: `idem_${randomBytes(6).toString("hex")}`,
  });
  return { store, publicRepo, summary };
}

async function main() {
  file("lib/checkout/infrastructure/durable-dnx-payments-client.ts");
  file("lib/checkout/application/reconcile-registration-payment.ts");
  assert(
    !file("lib/checkout/actions/runtime.ts").includes("createInMemoryDnxPaymentsStore()") ||
      file("lib/checkout/actions/runtime.ts").includes('mode === "memory"'),
    "runtime defaults to durable",
  );
  assert(
    file("app/api/webhooks/dnx-payments/route.ts").includes("x-signature") &&
      file("app/api/webhooks/dnx-payments/route.ts").includes("No acepta unsigned"),
    "webhook documented as signed Mercado Pago + DNX paths",
  );

  // URL safety
  assert(assertSafeCheckoutUrl("https://payments.test/x").ok, "fake https ok");
  assert(!assertSafeCheckoutUrl("javascript:alert(1)").ok, "js url blocked");
  assert(!assertSafeCheckoutUrl("https://evil.example/pay").ok, "arbitrary host blocked");

  // --- Durable memory path (no Neon, process restart simulation) ---
  const persistence = createInMemoryDnxPaymentsPersistence();
  const { store, publicRepo, summary } = await seedRegistration();
  const logs: Array<Record<string, unknown>> = [];

  const payments1 = createDurableDnxPaymentsClient({
    persistence,
    webhookSecret: "persist-secret",
    checkoutBaseUrl: "https://payments.test/checkout",
    isTestFixture: true,
  });
  const checkout1 = createCheckoutService({
    publicRepo,
    payments: payments1,
    mutations: createInMemoryCheckoutMutations(store),
    log: createMemoryLogSink(logs),
    publicBaseUrl: "http://localhost:3005",
  });

  const created = await checkout1.createCheckout({
    registrationId: summary.registrationId,
    editionSlug: "persist-2026",
    accessToken: summary.accessToken,
  });
  assert(created.paymentOrderId.startsWith("dnx_ord_"), "3 order created durable id");
  assert(created.checkoutUrl.includes(created.paymentOrderId), "checkout url persisted");

  // 5–7: destroy service instance, new instance recovers
  const payments2 = createDurableDnxPaymentsClient({
    persistence,
    webhookSecret: "persist-secret",
    checkoutBaseUrl: "https://payments.test/checkout",
    isTestFixture: true,
  });
  const recovered = await payments2.getOrder(created.paymentOrderId);
  assert(recovered, "7 recover order");
  assert(recovered!.checkoutUrl === created.checkoutUrl, "7 checkout url survives");
  assert(recovered!.amountMinor === 2500_00, "amount durable");

  const checkout2 = createCheckoutService({
    publicRepo,
    payments: payments2,
    mutations: createInMemoryCheckoutMutations(store),
    log: createMemoryLogSink(logs),
    publicBaseUrl: "http://localhost:3005",
  });
  const reused = await checkout2.createCheckout({
    registrationId: summary.registrationId,
    editionSlug: "persist-2026",
    accessToken: summary.accessToken,
  });
  assert(reused.reused && reused.paymentOrderId === created.paymentOrderId, "8 idempotency");

  // 9 concurrent
  const seedC = await seedRegistration();
  const payC = createDurableDnxPaymentsClient({
    persistence: createInMemoryDnxPaymentsPersistence(),
    webhookSecret: "s",
    isTestFixture: true,
  });
  const chkC = createCheckoutService({
    publicRepo: seedC.publicRepo,
    payments: payC,
    mutations: createInMemoryCheckoutMutations(seedC.store),
    publicBaseUrl: "http://localhost:3005",
  });
  const [c1, c2] = await Promise.all([
    chkC.createCheckout({
      registrationId: seedC.summary.registrationId,
      editionSlug: "persist-2026",
      accessToken: seedC.summary.accessToken,
    }),
    chkC.createCheckout({
      registrationId: seedC.summary.registrationId,
      editionSlug: "persist-2026",
      accessToken: seedC.summary.accessToken,
    }),
  ]);
  assert(
    c1.paymentOrderId === c2.paymentOrderId || c1.reused || c2.reused,
    "9 concurrent single effective order",
  );

  // 10–15 pending then approved + duplicate
  const evtPending = await payments2.simulateProviderEvent({
    orderId: created.paymentOrderId,
    providerStatus: "pending",
    eventId: "evt_pending_1",
  });
  const pendingRes = await checkout2.applyNormalizedEvent(evtPending);
  assert(pendingRes.applied, "10 pending applied");
  assert(
    store.domain.registrations.get(summary.registrationId)!.status === "PENDING_PAYMENT",
    "10 still pending reg",
  );

  const evtApproved = await payments2.simulateProviderEvent({
    orderId: created.paymentOrderId,
    providerStatus: "approved",
    eventId: "evt_approved_1",
  });
  const approvedRes = await checkout2.applyNormalizedEvent(evtApproved);
  assert(approvedRes.applied && approvedRes.holdsAction === "confirm", "11–13 approved");
  const reg = store.domain.registrations.get(summary.registrationId)!;
  assert(reg.status === "CONFIRMED" && reg.paymentStatus === "APPROVED", "12 confirmed");
  const hold = [...store.domain.capacityHolds.values()].find(
    (h) => h.registrationId === summary.registrationId,
  );
  assert(hold?.status === "CONSUMED", "13 holds confirmed");

  const dup = await checkout2.applyNormalizedEvent(evtApproved);
  assert(dup.duplicate || !dup.applied, "14–15 no duplicate effects");

  // 16 rejected path
  const seedR = await seedRegistration();
  const payR = createDurableDnxPaymentsClient({
    persistence: createInMemoryDnxPaymentsPersistence(),
    webhookSecret: "s",
    isTestFixture: true,
  });
  const chkR = createCheckoutService({
    publicRepo: seedR.publicRepo,
    payments: payR,
    mutations: createInMemoryCheckoutMutations(seedR.store),
    publicBaseUrl: "http://localhost:3005",
  });
  const ordR = await chkR.createCheckout({
    registrationId: seedR.summary.registrationId,
    editionSlug: "persist-2026",
    accessToken: seedR.summary.accessToken,
  });
  const rej = await payR.simulateProviderEvent({
    orderId: ordR.paymentOrderId,
    providerStatus: "rejected",
  });
  await chkR.applyNormalizedEvent(rej);
  assert(
    seedR.store.domain.registrations.get(seedR.summary.registrationId)!.paymentStatus ===
      "FAILED",
    "16 rejected",
  );

  // 17–18 expired releases holds
  const seedE = await seedRegistration();
  const payE = createDurableDnxPaymentsClient({
    persistence: createInMemoryDnxPaymentsPersistence(),
    webhookSecret: "s",
    isTestFixture: true,
  });
  const chkE = createCheckoutService({
    publicRepo: seedE.publicRepo,
    payments: payE,
    mutations: createInMemoryCheckoutMutations(seedE.store),
    publicBaseUrl: "http://localhost:3005",
  });
  const ordE = await chkE.createCheckout({
    registrationId: seedE.summary.registrationId,
    editionSlug: "persist-2026",
    accessToken: seedE.summary.accessToken,
  });
  const exp = await payE.simulateProviderEvent({
    orderId: ordE.paymentOrderId,
    providerStatus: "expired",
  });
  await chkE.applyNormalizedEvent(exp);
  const regE = seedE.store.domain.registrations.get(seedE.summary.registrationId)!;
  assert(regE.status === "CANCELLED" && regE.paymentStatus === "EXPIRED", "17 expired");
  const holdE = [...seedE.store.domain.capacityHolds.values()].find(
    (h) => h.registrationId === seedE.summary.registrationId,
  );
  assert(holdE?.status === "EXPIRED", "18 holds released");

  // 19–20 inbox / processing via durable apply
  const inboxAudits = await payments2.service.listOrderEvents(created.paymentOrderId);
  assert(
    inboxAudits.some((a) => a.action === "clickaton.checkout.event.applied"),
    "19–20 event audit",
  );

  // 22–24 mismatches
  const seedM = await seedRegistration();
  const payM = createDurableDnxPaymentsClient({
    persistence: createInMemoryDnxPaymentsPersistence(),
    webhookSecret: "s",
    isTestFixture: true,
  });
  const chkM = createCheckoutService({
    publicRepo: seedM.publicRepo,
    payments: payM,
    mutations: createInMemoryCheckoutMutations(seedM.store),
    publicBaseUrl: "http://localhost:3005",
  });
  const ordM = await chkM.createCheckout({
    registrationId: seedM.summary.registrationId,
    editionSlug: "persist-2026",
    accessToken: seedM.summary.accessToken,
  });
  const badAmount = await payM.simulateProviderEvent({
    orderId: ordM.paymentOrderId,
    providerStatus: "approved",
    amountMinor: 1,
  });
  const mm = await chkM.applyNormalizedEvent(badAmount);
  assert(mm.conflict && mm.conflictCode === "PAYMENT_AMOUNT_MISMATCH", "22 amount");

  const badSource = await payM.simulateProviderEvent({
    orderId: ordM.paymentOrderId,
    providerStatus: "approved",
    eventId: "evt_src",
    sourceId: "other",
  });
  let sourceBlocked = false;
  try {
    await chkM.applyNormalizedEvent(badSource);
  } catch {
    sourceBlocked = true;
  }
  if (!sourceBlocked) {
    const r = await chkM.applyNormalizedEvent({
      ...badSource,
      eventId: "evt_src2",
    });
    sourceBlocked = r.conflict === true;
  }
  assert(sourceBlocked, "24 source mismatch");

  // 25 reconcile
  const recon = await checkout2.reconcileRegistration(summary.registrationId);
  assert(recon.status === "CONSISTENT", "25 reconcile consistent after confirm");

  // 26–27 DTO / logs
  const ret = await checkout2.getCheckoutReturn({
    registrationId: summary.registrationId,
    editionSlug: "persist-2026",
    accessToken: summary.accessToken,
  });
  const dto = JSON.stringify(ret);
  assert(!dto.includes("persist-secret"), "26 no secret");
  assert(!JSON.stringify(logs).includes("luis.durable@example.com"), "27 no email");
  assert(!JSON.stringify(logs).includes("30999888"), "27 no document");

  // 28 memory not source of truth in runtime default
  const runtimeSrc = file("lib/checkout/actions/runtime.ts");
  assert(runtimeSrc.includes('?? "prisma"'), "28 default prisma");
  assert(runtimeSrc.includes("createPrismaDnxPaymentsPersistence"), "28 prisma client");

  // 29–30 no real payment / no Neon
  assert(!runtimeSrc.includes("api.mercadopago.com"), "29 no real MP");
  assert(!file("lib/checkout/infrastructure/durable-dnx-payments-client.ts").includes("neon"), "30 no neon");

  // --- Optional Prisma disposable DB ---
  let pgNote = "skipped";
  const disposable = createDisposableDb();
  try {
    process.env.DATABASE_URL = disposable.url;
    process.env.DIRECT_URL = disposable.url;
    console.log(
      `persistence_selfcheck_pg=127.0.0.1:${disposable.port} db=${disposable.dbName}`,
    );
    execSync("pnpm --filter @repo/db exec prisma migrate deploy", {
      cwd: join(ROOT, "../.."),
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: disposable.url, DIRECT_URL: disposable.url },
    });

    // Resolver @prisma/client desde packages/db (evita Prisma 7 global del usuario).
    const dbRequire = createRequire(join(ROOT, "../../packages/db/package.json"));
    const { PrismaClient } = dbRequire("@prisma/client") as {
      PrismaClient: new (args?: unknown) => {
        $disconnect: () => Promise<void>;
      } & DnxPaymentsPrismaDelegates;
    };
    const prisma = new PrismaClient({
      datasources: { db: { url: disposable.url } },
    });
    try {
      const pgPersistence = createPrismaDnxPaymentsPersistence(prisma);
      const pgPayments = createDurableDnxPaymentsClient({
        persistence: pgPersistence,
        webhookSecret: "pg-secret",
        isTestFixture: true,
      });
      const seedPg = await seedRegistration();
      const chkPg = createCheckoutService({
        publicRepo: seedPg.publicRepo,
        payments: pgPayments,
        mutations: createInMemoryCheckoutMutations(seedPg.store),
        publicBaseUrl: "http://localhost:3005",
      });
      const ordPg = await chkPg.createCheckout({
        registrationId: seedPg.summary.registrationId,
        editionSlug: "persist-2026",
        accessToken: seedPg.summary.accessToken,
      });
      const againPg = createDurableDnxPaymentsClient({
        persistence: createPrismaDnxPaymentsPersistence(prisma),
        webhookSecret: "pg-secret",
        isTestFixture: true,
      });
      const loadedPg = await againPg.getOrder(ordPg.paymentOrderId);
      assert(loadedPg?.id === ordPg.paymentOrderId, "pg recover");
      pgNote = `ok port=${disposable.port}`;
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    disposable.drop();
  }

  console.log(`dnx-payments-persistence.selfcheck: OK (${pgNote})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
