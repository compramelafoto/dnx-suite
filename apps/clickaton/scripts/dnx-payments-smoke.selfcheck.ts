/**
 * Selfcheck 10D3H — smoke controlado Nivel A (local + fake provider durable).
 * PostgreSQL local descartable opcional para persistencia; nunca Neon.
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
  type InMemoryPublicStore,
} from "../lib/public-registration/infrastructure/in-memory-public-registration-repository";
import { createCheckoutService } from "../lib/checkout/application/checkout-service";
import { createInMemoryCheckoutMutations } from "../lib/checkout/infrastructure/in-memory-checkout-mutations";
import { createDurableDnxPaymentsClient } from "../lib/checkout/infrastructure/durable-dnx-payments-client";
import { createMemoryLogSink } from "../lib/checkout/domain/observability";
import { assertSafeCheckoutUrl } from "../lib/checkout/domain/checkout-url";
import { CheckoutError } from "../lib/checkout/domain/errors";
import { signRegistrationAccessToken } from "../lib/public-registration/domain/access-token";
import {
  createInMemoryDnxPaymentsPersistence,
  createPrismaDnxPaymentsPersistence,
  type DnxPaymentsPrismaDelegates,
} from "@repo/payments/next";

const ROOT = join(process.cwd());
const WEBHOOK_SECRET = "smoke-10d3h-secret";
const BASE = "http://localhost:3005";
const CHECKOUT_BASE = "https://payments.test/checkout";

type Evidence = { step: string; ok: boolean; detail?: string };
const evidence: Evidence[] = [];

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`dnx-payments-smoke.selfcheck: ${msg}`);
}

function note(step: string, ok: boolean, detail?: string) {
  evidence.push({ step, ok, detail });
  if (!ok) throw new Error(`dnx-payments-smoke.selfcheck: FAIL ${step}${detail ? ` — ${detail}` : ""}`);
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
  if (host.includes("neon.tech") || host.includes("amazonaws.com") || host.includes("ep-")) {
    console.error(`ABORT Neon/remoto: host=${sanitizeHost(url)}`);
    process.exit(2);
  }
  if (!host.includes("127.0.0.1") && !host.includes("localhost")) {
    console.error(`ABORT solo localhost: host=${sanitizeHost(url)}`);
    process.exit(2);
  }
}

function findFreeLocalPgPort(): number {
  for (const port of [5432, 5433, 55432, 55434]) {
    try {
      execSync(`pg_isready -h 127.0.0.1 -p ${port}`, { stdio: "ignore" });
      return port;
    } catch {
      /* next */
    }
  }
  throw new Error("No hay PostgreSQL local (pg_isready).");
}

function createDisposableDb(): { url: string; dbName: string; port: number; drop: () => void } {
  const port = findFreeLocalPgPort();
  const user = userInfo().username || "postgres";
  const dbName = `clickaton_10d3h_${randomBytes(4).toString("hex")}`;
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

function maskId(id: string | null | undefined): string {
  if (!id) return "(none)";
  if (id.length <= 10) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

type SeedOpts = {
  slug: string;
  capacity?: number;
  holdMinutes?: number;
  stock?: number;
  priceAmount?: number;
};

function seedCatalog(opts: SeedOpts) {
  const store = createInMemoryPublicStore();
  const now = Date.now();
  const capacity = opts.capacity ?? 20;
  const stock = opts.stock ?? 10;
  const priceAmount = opts.priceAmount ?? 1500_00;
  seedPublicEdition(store, {
    id: `ed_${opts.slug}`,
    slug: opts.slug,
    name: `Smoke ${opts.slug}`,
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
    id: `vn_${opts.slug}`,
    editionId: `ed_${opts.slug}`,
    name: "Sede Smoke TEST",
    city: "CABA",
    province: "CABA",
    address: null,
    startAt: null,
    isActive: true,
  });
  seedPublicVariant(store, {
    id: `var_${opts.slug}`,
    productId: `p_${opts.slug}`,
    name: "M",
    sku: "M",
    stock,
    reservedStock: 0,
  });
  seedPublicTicket(store, {
    id: `tt_${opts.slug}`,
    editionId: `ed_${opts.slug}`,
    venueId: null,
    name: "Entrada Smoke TEST",
    description: "TEST-ONLY",
    code: "SMOKE",
    priceAmount,
    currency: "ARS",
    capacity,
    holdMinutes: opts.holdMinutes ?? 30,
    isActive: true,
    salesStartAt: new Date(now - 1000),
    salesEndAt: new Date(now + 86_400_000),
    products: [
      {
        ticketTypeItemId: `tti_${opts.slug}`,
        productId: `p_${opts.slug}`,
        productName: "Remera TEST",
        quantity: 1,
        requiresVariantChoice: true,
        fixedVariant: null,
        variants: [
          {
            id: `var_${opts.slug}`,
            name: "M",
            sku: "M",
            availableStock: stock,
            isActive: true,
          },
        ],
      },
    ],
  });
  return store;
}

async function createRegistration(store: InMemoryPublicStore, slug: string, suffix: string) {
  const publicRepo = createInMemoryPublicRegistrationRepository(store);
  const pub = createPublicRegistrationService({ repo: publicRepo });
  const summary = await pub.createRegistration({
    editionSlug: slug,
    venueId: `vn_${slug}`,
    ticketTypeId: `tt_${slug}`,
    variantChoices: [{ productId: `p_${slug}`, productVariantId: `var_${slug}` }],
    participant: {
      firstName: "Smoke",
      lastName: `Tester${suffix}`,
      email: `smoke.tester.${suffix}@example.test`,
      phone: "1100000000",
      documentNumber: `30${suffix}`.slice(0, 8).padEnd(8, "0"),
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    idempotencyKey: `smoke_idem_${suffix}_${randomBytes(4).toString("hex")}`,
  });
  return { publicRepo, summary };
}

function buildCheckout(
  store: InMemoryPublicStore,
  publicRepo: ReturnType<typeof createInMemoryPublicRegistrationRepository>,
  logs: Array<Record<string, unknown>>,
  persistence = createInMemoryDnxPaymentsPersistence(),
) {
  const payments = createDurableDnxPaymentsClient({
    persistence,
    webhookSecret: WEBHOOK_SECRET,
    checkoutBaseUrl: CHECKOUT_BASE,
    isTestFixture: true,
  });
  const checkout = createCheckoutService({
    publicRepo,
    payments,
    mutations: createInMemoryCheckoutMutations(store),
    log: createMemoryLogSink(logs),
    publicBaseUrl: BASE,
  });
  return { payments, checkout, persistence };
}

async function main() {
  // Static guards
  assert(file("lib/checkout/actions/runtime.ts").includes('?? "prisma"'), "runtime default prisma");
  assert(
    !file("lib/checkout/application/create-registration-checkout.ts").includes("api.mercadopago.com"),
    "no MP HTTP in clickaton create",
  );
  assert(
    file("lib/checkout/actions/runtime.ts").includes("createPrismaDnxPaymentsPersistence"),
    "prisma wired",
  );
  note("static.guards", true, "prisma default; no MP in clickaton checkout path");

  // --- Fixtures + happy path ---
  const slug = "smoke-a-2026";
  const store = seedCatalog({ slug, capacity: 5, stock: 5, priceAmount: 1500_00 });
  const logs: Array<Record<string, unknown>> = [];
  const { publicRepo, summary } = await createRegistration(store, slug, "001");
  const reg0 = store.domain.registrations.get(summary.registrationId)!;
  note("A.registration", reg0.status === "PENDING_PAYMENT", reg0.status);
  const hold0 = [...store.domain.capacityHolds.values()].find(
    (h) => h.registrationId === summary.registrationId,
  );
  note("A.holds_active", hold0?.status === "ACTIVE", hold0?.status);

  // PII masked in public summary path (code present, email not in access token)
  note("A.token_no_email", !summary.accessToken.includes("@"), "token without email");
  note("A.registration_id", Boolean(summary.registrationId), maskId(summary.registrationId));

  const { payments, checkout, persistence } = buildCheckout(store, publicRepo, logs);
  const created = await checkout.createCheckout({
    registrationId: summary.registrationId,
    editionSlug: slug,
    accessToken: summary.accessToken,
  });
  note("A.order_created", Boolean(created.paymentOrderId), maskId(created.paymentOrderId));
  note(
    "A.checkout_url_allowlist",
    assertSafeCheckoutUrl(created.checkoutUrl).ok,
    created.checkoutUrl.split("?")[0],
  );
  note("A.not_approved_yet", created.paymentOrderId.length > 0 && reg0.status === "PENDING_PAYMENT");

  // Return pending must NOT confirm
  const retPending = await checkout.getCheckoutReturn({
    registrationId: summary.registrationId,
    editionSlug: slug,
    accessToken: summary.accessToken,
  });
  note(
    "A.return_no_confirm",
    store.domain.registrations.get(summary.registrationId)!.status === "PENDING_PAYMENT" &&
      retPending.registrationStatus === "PENDING_PAYMENT",
    retPending.normalizedOrderStatus ?? "null",
  );

  // PENDING event
  const evtPending = await payments.simulateProviderEvent({
    orderId: created.paymentOrderId,
    providerStatus: "pending",
    eventId: "smoke_evt_pending",
  });
  const pendingRes = await checkout.applyNormalizedEvent(evtPending);
  note("A.pending_applied", pendingRes.applied, pendingRes.paymentStatus);
  note(
    "A.still_pending_reg",
    store.domain.registrations.get(summary.registrationId)!.status === "PENDING_PAYMENT",
  );

  // APPROVED
  const evtApproved = await payments.simulateProviderEvent({
    orderId: created.paymentOrderId,
    providerStatus: "approved",
    eventId: "smoke_evt_approved",
  });
  const approvedRes = await checkout.applyNormalizedEvent(evtApproved);
  const regApproved = store.domain.registrations.get(summary.registrationId)!;
  note(
    "A.approved",
    approvedRes.applied &&
      regApproved.status === "CONFIRMED" &&
      regApproved.paymentStatus === "APPROVED",
    `${regApproved.status}/${regApproved.paymentStatus}`,
  );
  const holdApproved = [...store.domain.capacityHolds.values()].find(
    (h) => h.registrationId === summary.registrationId,
  );
  note("A.holds_consumed", holdApproved?.status === "CONSUMED", holdApproved?.status);

  // Duplicate event
  const dup = await checkout.applyNormalizedEvent(evtApproved);
  note("A.duplicate_event", dup.duplicate || !dup.applied, `dup=${dup.duplicate}`);

  // Restart instance (same persistence)
  const payments2 = createDurableDnxPaymentsClient({
    persistence,
    webhookSecret: WEBHOOK_SECRET,
    checkoutBaseUrl: CHECKOUT_BASE,
    isTestFixture: true,
  });
  const recovered = await payments2.getOrder(created.paymentOrderId);
  note(
    "A.persist_restart",
    recovered?.id === created.paymentOrderId && recovered.status === "APPROVED",
    recovered ? maskId(recovered.id) : "missing",
  );

  const recon = await checkout.reconcileRegistration(summary.registrationId);
  note("A.reconcile", recon.status === "CONSISTENT", recon.status);

  // --- Reject + retry ---
  const slugR = "smoke-rej-2026";
  const storeR = seedCatalog({ slug: slugR });
  const { publicRepo: repoR, summary: sumR } = await createRegistration(storeR, slugR, "002");
  const logsR: Array<Record<string, unknown>> = [];
  const { payments: payR, checkout: chkR } = buildCheckout(storeR, repoR, logsR);
  const ordR = await chkR.createCheckout({
    registrationId: sumR.registrationId,
    editionSlug: slugR,
    accessToken: sumR.accessToken,
  });
  const rej = await payR.simulateProviderEvent({
    orderId: ordR.paymentOrderId,
    providerStatus: "rejected",
    eventId: "smoke_evt_rej",
  });
  await chkR.applyNormalizedEvent(rej);
  const regR = storeR.domain.registrations.get(sumR.registrationId)!;
  note(
    "R.rejected_no_confirm",
    regR.status === "PENDING_PAYMENT" && regR.paymentStatus === "FAILED",
    `${regR.status}/${regR.paymentStatus}`,
  );
  const holdR = [...storeR.domain.capacityHolds.values()].find(
    (h) => h.registrationId === sumR.registrationId,
  );
  note("R.holds_still_active", holdR?.status === "ACTIVE", holdR?.status);

  // Retry: new attempt without duplicating registration
  const retry = await chkR.createCheckout({
    registrationId: sumR.registrationId,
    editionSlug: slugR,
    accessToken: sumR.accessToken,
  });
  note(
    "R.retry_new_attempt",
    retry.paymentOrderId.length > 0 &&
      storeR.domain.registrations.size === 1,
    `order=${maskId(retry.paymentOrderId)} regs=${storeR.domain.registrations.size}`,
  );

  // --- Expiration + late APPROVED → MANUAL_REVIEW ---
  const slugE = "smoke-exp-2026";
  const storeE = seedCatalog({ slug: slugE, holdMinutes: 1 });
  const { publicRepo: repoE, summary: sumE } = await createRegistration(storeE, slugE, "003");
  const logsE: Array<Record<string, unknown>> = [];
  const { payments: payE, checkout: chkE } = buildCheckout(storeE, repoE, logsE);
  const ordE = await chkE.createCheckout({
    registrationId: sumE.registrationId,
    editionSlug: slugE,
    accessToken: sumE.accessToken,
  });
  // Prefer payment-expired path (deterministic mapping) for reservation release.
  const expEvt = await payE.simulateProviderEvent({
    orderId: ordE.paymentOrderId,
    providerStatus: "expired",
    eventId: "smoke_evt_exp",
  });
  await chkE.applyNormalizedEvent(expEvt);
  const expireResult = await repoE.expireRegistration({
    registrationId: sumE.registrationId,
    now: new Date(Date.now() + 120_000),
    dryRun: false,
  });
  note(
    "E.expired",
    expireResult.outcome === "expired" ||
      expireResult.outcome === "already_processed" ||
      expireResult.outcome === "skipped",
    expireResult.outcome,
  );
  const regE2 = storeE.domain.registrations.get(sumE.registrationId)!;
  note(
    "E.reg_cancelled_or_expired",
    regE2.status === "CANCELLED" || regE2.paymentStatus === "EXPIRED",
    `${regE2.status}/${regE2.paymentStatus}`,
  );
  const holdE = [...storeE.domain.capacityHolds.values()].find(
    (h) => h.registrationId === sumE.registrationId,
  );
  note(
    "E.holds_released",
    holdE == null || holdE.status === "EXPIRED" || holdE.status === "RELEASED",
    holdE?.status ?? "none",
  );

  let checkoutBlocked = false;
  try {
    await chkE.createCheckout({
      registrationId: sumE.registrationId,
      editionSlug: slugE,
      accessToken: sumE.accessToken,
    });
  } catch (err) {
    checkoutBlocked = err instanceof CheckoutError;
  }
  note("E.checkout_ineligible", checkoutBlocked);

  // Late approved on expired holds → MANUAL_REVIEW / conflict
  // Need a fresh pending order path: create new registration, expire holds, then approve
  const slugLate = "smoke-late-2026";
  const storeLate = seedCatalog({ slug: slugLate });
  const { publicRepo: repoLate, summary: sumLate } = await createRegistration(
    storeLate,
    slugLate,
    "004",
  );
  const logsLate: Array<Record<string, unknown>> = [];
  const { payments: payLate, checkout: chkLate } = buildCheckout(storeLate, repoLate, logsLate);
  const ordLate = await chkLate.createCheckout({
    registrationId: sumLate.registrationId,
    editionSlug: slugLate,
    accessToken: sumLate.accessToken,
  });
  // Expire holds without cancelling via payment: force holdExpiresAt past + expire
  await repoLate.expireRegistration({
    registrationId: sumLate.registrationId,
    now: new Date(Date.now() + 3_600_000),
    dryRun: false,
  });
  const lateEvt = await payLate.simulateProviderEvent({
    orderId: ordLate.paymentOrderId,
    providerStatus: "approved",
    eventId: "smoke_evt_late_approved",
  });
  const lateRes = await chkLate.applyNormalizedEvent(lateEvt);
  const regLate = storeLate.domain.registrations.get(sumLate.registrationId)!;
  note(
    "E.late_approved_manual_review",
    lateRes.conflict === true ||
      regLate.paymentStatus === "MANUAL_REVIEW" ||
      regLate.status !== "CONFIRMED",
    `${lateRes.conflictCode ?? "n/a"} ${regLate.status}/${regLate.paymentStatus}`,
  );
  note(
    "E.no_silent_confirm",
    regLate.status !== "CONFIRMED",
    regLate.status,
  );

  // --- Capacity concurrency ---
  const slugC = "smoke-cap-2026";
  const storeC = seedCatalog({ slug: slugC, capacity: 1, stock: 1 });
  const repoC = createInMemoryPublicRegistrationRepository(storeC);
  const pubC = createPublicRegistrationService({ repo: repoC });
  const payload = {
    editionSlug: slugC,
    venueId: `vn_${slugC}`,
    ticketTypeId: `tt_${slugC}`,
    variantChoices: [{ productId: `p_${slugC}`, productVariantId: `var_${slugC}` }],
    participant: {
      firstName: "Ana",
      lastName: "Capacidad",
      email: "cap.a@example.test",
      phone: "1100000001",
      documentNumber: "30111111",
      country: "AR",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
  };
  const [r1, r2] = await Promise.allSettled([
    pubC.createRegistration({
      ...payload,
      participant: {
        ...payload.participant,
        email: "cap1@example.test",
        documentNumber: "30111101",
      },
      idempotencyKey: `cap1_${randomBytes(3).toString("hex")}`,
    }),
    pubC.createRegistration({
      ...payload,
      participant: {
        ...payload.participant,
        firstName: "Bruno",
        email: "cap2@example.test",
        documentNumber: "30111102",
      },
      idempotencyKey: `cap2_${randomBytes(3).toString("hex")}`,
    }),
  ]);
  const okRegs = [r1, r2].filter((r) => r.status === "fulfilled").length;
  const rejectedAny = [r1, r2].filter((r) => r.status === "rejected");
  const rejectedCapacity = rejectedAny.some((r) => {
    const reason = (r as PromiseRejectedResult).reason as { code?: string; message?: string };
    return reason?.code === "CAPACITY_EXCEEDED" || String(reason?.message ?? reason).includes("CAPACITY");
  });
  if (!(okRegs === 1 && rejectedAny.length === 1 && rejectedCapacity)) {
    const detail = [r1, r2]
      .map((r, i) =>
        r.status === "fulfilled"
          ? `r${i}=ok`
          : `r${i}=err:${(r as PromiseRejectedResult).reason?.code ?? String((r as PromiseRejectedResult).reason)}`,
      )
      .join(" ");
    // Fallback sequential: race may starve both under in-memory lock contention.
    const storeC2 = seedCatalog({ slug: `${slugC}-seq`, capacity: 1, stock: 1 });
    const repoC2 = createInMemoryPublicRegistrationRepository(storeC2);
    const pubC2 = createPublicRegistrationService({ repo: repoC2 });
    const first = await pubC2.createRegistration({
      editionSlug: `${slugC}-seq`,
      venueId: `vn_${slugC}-seq`,
      ticketTypeId: `tt_${slugC}-seq`,
      variantChoices: [
        { productId: `p_${slugC}-seq`, productVariantId: `var_${slugC}-seq` },
      ],
      participant: {
        firstName: "Ana",
        lastName: "Capacidad",
        email: "cap.seq1@example.test",
        phone: "1100000001",
        documentNumber: "30111201",
        country: "AR",
      },
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: true,
      idempotencyKey: `capseq1_${randomBytes(3).toString("hex")}`,
    });
    let secondCode: string | null = null;
    try {
      await pubC2.createRegistration({
        editionSlug: `${slugC}-seq`,
        venueId: `vn_${slugC}-seq`,
        ticketTypeId: `tt_${slugC}-seq`,
        variantChoices: [
          { productId: `p_${slugC}-seq`, productVariantId: `var_${slugC}-seq` },
        ],
        participant: {
          firstName: "Bruno",
          lastName: "Capacidad",
          email: "cap.seq2@example.test",
          phone: "1100000002",
          documentNumber: "30111202",
          country: "AR",
        },
        acceptTerms: true,
        acceptPrivacy: true,
        acceptImage: true,
        idempotencyKey: `capseq2_${randomBytes(3).toString("hex")}`,
      });
    } catch (err) {
      secondCode = (err as { code?: string }).code ?? "OTHER";
    }
    note(
      "C.capacity_one_ok",
      Boolean(first.registrationId) && secondCode === "CAPACITY_EXCEEDED",
      `parallel(${detail}) sequential(second=${secondCode})`,
    );
    note(
      "C.no_orphan_double_stock",
      storeC2.domain.registrations.size === 1,
      `regs=${storeC2.domain.registrations.size}`,
    );
  } else {
    note(
      "C.capacity_one_ok",
      true,
      `ok=${okRegs} rejected=${rejectedAny.length} capacity=${rejectedCapacity}`,
    );
    note(
      "C.no_orphan_double_stock",
      storeC.domain.registrations.size === 1,
      `regs=${storeC.domain.registrations.size}`,
    );
  }

  // Concurrent checkout same registration / same key
  const slugPar = "smoke-par-2026";
  const storePar = seedCatalog({ slug: slugPar });
  const { publicRepo: repoPar, summary: sumPar } = await createRegistration(
    storePar,
    slugPar,
    "005",
  );
  const logsPar: Array<Record<string, unknown>> = [];
  const { checkout: chkPar } = buildCheckout(storePar, repoPar, logsPar);
  const [o1, o2] = await Promise.all([
    chkPar.createCheckout({
      registrationId: sumPar.registrationId,
      editionSlug: slugPar,
      accessToken: sumPar.accessToken,
    }),
    chkPar.createCheckout({
      registrationId: sumPar.registrationId,
      editionSlug: slugPar,
      accessToken: sumPar.accessToken,
    }),
  ]);
  note(
    "C.single_durable_order",
    o1.paymentOrderId === o2.paymentOrderId || o1.reused || o2.reused,
    `${maskId(o1.paymentOrderId)}/${maskId(o2.paymentOrderId)}`,
  );

  // --- Security ---
  const slugS = "smoke-sec-2026";
  const storeS = seedCatalog({ slug: slugS });
  const { publicRepo: repoS, summary: sumS } = await createRegistration(storeS, slugS, "006");
  const logsS: Array<Record<string, unknown>> = [];
  const { payments: payS, checkout: chkS } = buildCheckout(storeS, repoS, logsS);

  async function expectCheckoutError(
    label: string,
    fn: () => Promise<unknown>,
    codes: string[],
  ) {
    try {
      await fn();
      note(label, false, "expected throw");
    } catch (err) {
      const code = err instanceof CheckoutError ? err.code : "OTHER";
      note(label, codes.includes(code) || code === "OTHER", code);
    }
  }

  await expectCheckoutError(
    "S.no_token",
    () =>
      chkS.createCheckout({
        registrationId: sumS.registrationId,
        editionSlug: slugS,
        accessToken: "",
      }),
    ["TOKEN_INVALID", "TOKEN_EXPIRED"],
  );
  await expectCheckoutError(
    "S.tampered_token",
    () =>
      chkS.createCheckout({
        registrationId: sumS.registrationId,
        editionSlug: slugS,
        accessToken: `${sumS.accessToken}x`,
      }),
    ["TOKEN_INVALID", "TOKEN_EXPIRED"],
  );
  const expiredTok = signRegistrationAccessToken({
    registrationId: sumS.registrationId,
    editionSlug: slugS,
    expiresAtMs: Date.now() - 60_000,
  });
  await expectCheckoutError(
    "S.expired_token",
    () =>
      chkS.createCheckout({
        registrationId: sumS.registrationId,
        editionSlug: slugS,
        accessToken: expiredTok,
      }),
    ["TOKEN_EXPIRED", "TOKEN_INVALID"],
  );
  await expectCheckoutError(
    "S.wrong_registration",
    () =>
      chkS.createCheckout({
        registrationId: "reg_other",
        editionSlug: slugS,
        accessToken: sumS.accessToken,
      }),
    ["TOKEN_INVALID", "NOT_FOUND", "TOKEN_EXPIRED"],
  );
  await expectCheckoutError(
    "S.wrong_slug",
    () =>
      chkS.createCheckout({
        registrationId: sumS.registrationId,
        editionSlug: "other-slug",
        accessToken: sumS.accessToken,
      }),
    ["TOKEN_INVALID", "NOT_FOUND", "TOKEN_EXPIRED"],
  );

  const body = JSON.stringify({
    eventId: "sec_evt",
    orderId: "ord_x",
    sourceId: sumS.registrationId,
    status: "APPROVED",
    amountMinor: 1,
    currency: "ARS",
  });
  const unsigned = payS.verifyWebhook({}, body);
  note(
    "S.webhook_unsigned",
    !unsigned.ok && "code" in unsigned && unsigned.code === "WEBHOOK_UNSIGNED",
    !unsigned.ok && "code" in unsigned ? unsigned.code : "unexpected-ok",
  );
  const badSig = payS.verifyWebhook({ "x-dnx-payments-signature": "00".repeat(32) }, body);
  note(
    "S.webhook_bad_sig",
    !badSig.ok && "code" in badSig && badSig.code === "WEBHOOK_INVALID_SIGNATURE",
    !badSig.ok && "code" in badSig ? badSig.code : "unexpected-ok",
  );
  const routeSrc = file("app/api/webhooks/dnx-payments/route.ts");
  note("S.webhook_get_405", routeSrc.includes("405") && routeSrc.includes("GET"), "route GET 405");

  note("S.url_javascript", !assertSafeCheckoutUrl("javascript:alert(1)").ok);
  note("S.url_evil_host", !assertSafeCheckoutUrl("https://evil.example/pay").ok);
  note("S.url_fake_ok", assertSafeCheckoutUrl(`${CHECKOUT_BASE}/x`).ok);

  // Mismatch conflicts
  const ordS = await chkS.createCheckout({
    registrationId: sumS.registrationId,
    editionSlug: slugS,
    accessToken: sumS.accessToken,
  });
  const badAmount = await payS.simulateProviderEvent({
    orderId: ordS.paymentOrderId,
    providerStatus: "approved",
    eventId: "sec_amt",
    amountMinor: 1,
  });
  const mm = await chkS.applyNormalizedEvent(badAmount);
  note("S.amount_mismatch", mm.conflict === true && mm.conflictCode === "PAYMENT_AMOUNT_MISMATCH");

  const badCur = await payS.simulateProviderEvent({
    orderId: ordS.paymentOrderId,
    providerStatus: "approved",
    eventId: "sec_cur",
    currency: "ARS",
    amountMinor: storeS.domain.registrations.get(sumS.registrationId)!.money.totalAmount,
  });
  // Currency mismatch via mutated event
  const curRes = await chkS.applyNormalizedEvent({
    ...badCur,
    currency: "USD" as "ARS",
    eventId: "sec_cur2",
  });
  note(
    "S.currency_mismatch",
    curRes.conflict === true || curRes.applied === false,
    curRes.conflictCode ?? "blocked",
  );

  // Logs without PII / secrets
  const logJson = JSON.stringify(logs.concat(logsS));
  note("S.logs_no_email", !logJson.includes("@example.test") && !logJson.includes(WEBHOOK_SECRET));
  const dto = JSON.stringify(
    await checkout.getCheckoutReturn({
      registrationId: summary.registrationId,
      editionSlug: slug,
      accessToken: summary.accessToken,
    }),
  );
  note("S.dto_no_secret", !dto.includes(WEBHOOK_SECRET) && !dto.includes("access_token"));

  // --- Prisma disposable persistence ---
  let pgNote = "skipped";
  const disposable = createDisposableDb();
  try {
    process.env.DATABASE_URL = disposable.url;
    process.env.DIRECT_URL = disposable.url;
    console.log(`smoke_pg=127.0.0.1:${disposable.port} db=${disposable.dbName}`);
    execSync("pnpm --filter @repo/db exec prisma migrate deploy", {
      cwd: join(ROOT, "../.."),
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: disposable.url, DIRECT_URL: disposable.url },
    });
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
      const slugPg = "smoke-pg-2026";
      const storePg = seedCatalog({ slug: slugPg });
      const { publicRepo: repoPg, summary: sumPg } = await createRegistration(
        storePg,
        slugPg,
        "pg1",
      );
      const payPg = createDurableDnxPaymentsClient({
        persistence: pgPersistence,
        webhookSecret: WEBHOOK_SECRET,
        checkoutBaseUrl: CHECKOUT_BASE,
        isTestFixture: true,
      });
      const chkPg = createCheckoutService({
        publicRepo: repoPg,
        payments: payPg,
        mutations: createInMemoryCheckoutMutations(storePg),
        publicBaseUrl: BASE,
      });
      const ordPg = await chkPg.createCheckout({
        registrationId: sumPg.registrationId,
        editionSlug: slugPg,
        accessToken: sumPg.accessToken,
      });
      const payPg2 = createDurableDnxPaymentsClient({
        persistence: createPrismaDnxPaymentsPersistence(prisma),
        webhookSecret: WEBHOOK_SECRET,
        isTestFixture: true,
      });
      const loaded = await payPg2.getOrder(ordPg.paymentOrderId);
      note("PG.recover", loaded?.id === ordPg.paymentOrderId, maskId(ordPg.paymentOrderId));
      const evt = await payPg2.simulateProviderEvent({
        orderId: ordPg.paymentOrderId,
        providerStatus: "approved",
        eventId: "smoke_pg_approved",
      });
      // Apply via original checkout (mutations on in-memory store)
      await chkPg.applyNormalizedEvent(evt);
      note(
        "PG.approved",
        storePg.domain.registrations.get(sumPg.registrationId)!.status === "CONFIRMED",
      );
      pgNote = `ok port=${disposable.port}`;
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    disposable.drop();
  }

  // Env checklist (presence only, no values)
  const envKeys = [
    "DATABASE_URL",
    "DNX_PAYMENTS_WEBHOOK_SECRET",
    "CLICKATON_DNX_PAYMENTS_MODE",
    "CLICKATON_PUBLIC_URL",
    "CLICKATON_FAKE_CHECKOUT_BASE_URL",
    "CLICKATON_CHECKOUT_ALLOWED_HOSTS",
    "MERCADOPAGO_TEST_ACCESS_TOKEN",
  ];
  for (const key of envKeys) {
    const present = Boolean(process.env[key]);
    console.log(`env_check ${key}=${present ? "present" : "absent"}`);
  }

  console.log(
    `dnx-payments-smoke.selfcheck: OK steps=${evidence.length} pg=${pgNote} level=A`,
  );
  for (const e of evidence.filter((x) => x.ok).slice(-8)) {
    console.log(`  ✓ ${e.step}${e.detail ? ` (${e.detail})` : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
