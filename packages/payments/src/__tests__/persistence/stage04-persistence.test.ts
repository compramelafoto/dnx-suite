import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInMemoryDnxPaymentsPersistence,
  ImmutableSplitError,
  PersistenceConflictError,
  sanitizeMetadata,
  createIntentUnit,
  reserveIdempotencyUnit,
  registerProviderOrderUnit,
  assertHttpOutsideTransaction,
} from "../../application/persistence/index.js";
import { runSandboxPreflight, loadSandboxEnvFromProcess } from "../../sandbox/preflight.js";
import {
  createPrismaDnxPaymentsPersistence,
  mapEnvToPrisma,
  mapProviderToPrisma,
} from "../../infrastructure/prisma/index.js";

function now() {
  return new Date().toISOString();
}

describe("sandbox preflight", () => {
  it("rejects missing TEST token", () => {
    const result = runSandboxPreflight({
      environment: "sandbox",
      confirm: true,
    });
    assert.equal(result.status, "MISSING_TEST_TOKEN");
  });

  it("rejects APP_USR production environment even with APP_USR token", () => {
    const result = runSandboxPreflight({
      accessToken: "APP_USR-secret",
      ownerUserId: "123",
      partnerEmail: "TESTUSER1@testuser.com",
      environment: "production",
      confirm: true,
    });
    assert.equal(result.status, "PRODUCTION_TOKEN_REJECTED");
  });

  it("accepts APP_USR- MLA test panel token in sandbox dry-run when partner ok", () => {
    const result = runSandboxPreflight({
      accessToken: "APP_USR-secret",
      ownerUserId: "123",
      partnerEmail: "TESTUSER1@testuser.com",
      environment: "sandbox",
      dryRun: true,
    });
    assert.equal(result.status, "READY");
    assert.equal(result.checks.tokenIsSandboxEligible, true);
  });

  it("rejects invalid partner email", () => {
    const result = runSandboxPreflight({
      accessToken: "TEST-abc",
      ownerUserId: "123",
      partnerEmail: "real@example.com",
      environment: "sandbox",
      confirm: true,
    });
    assert.equal(result.status, "BLOCKED_BY_TEST_PARTNER_EMAIL");
  });

  it("rejects numeric partner user id as email", () => {
    const result = runSandboxPreflight({
      accessToken: "TEST-abc",
      ownerUserId: "123",
      partnerEmail: "987654321",
      environment: "sandbox",
      dryRun: true,
    });
    assert.equal(result.status, "BLOCKED_BY_TEST_PARTNER_EMAIL");
    assert.equal(result.checks.partnerLooksLikeUserId, true);
  });

  it("requires confirmation when not dry-run", () => {
    const result = runSandboxPreflight({
      accessToken: "TEST-abc",
      ownerUserId: "123",
      partnerEmail: "TESTUSER1@testuser.com",
      environment: "sandbox",
      confirm: false,
      dryRun: false,
    });
    assert.equal(result.status, "CONFIRMATION_REQUIRED");
  });

  it("returns READY for dry-run with valid TEST inputs", () => {
    const result = runSandboxPreflight({
      accessToken: "TEST-abc",
      ownerUserId: "123",
      partnerEmail: "TESTUSER1@testuser.com",
      environment: "sandbox",
      dryRun: true,
    });
    assert.equal(result.status, "READY");
    assert.equal(result.checks.productionGuardActive, true);
  });

  it("loadSandboxEnvFromProcess never throws", () => {
    const loaded = loadSandboxEnvFromProcess({});
    assert.equal(loaded.environment, "sandbox");
  });
});

describe("persistence memory repositories", () => {
  it("enforces unique provider recipient account", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const nowIso = now();
    await db.recipients.save({
      id: "r1",
      recipientType: "PHOTOGRAPHER",
      status: "ACTIVE",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await db.providerAccounts.save({
      id: "a1",
      recipientId: "r1",
      provider: "mercadopago",
      environment: "sandbox",
      providerAccountReference: "owner-1",
      providerOwnerEligible: true,
      status: "ACTIVE",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await assert.rejects(
      () =>
        db.providerAccounts.save({
          id: "a2",
          recipientId: "r1",
          provider: "mercadopago",
          environment: "sandbox",
          providerAccountReference: "owner-1",
          providerOwnerEligible: true,
          status: "ACTIVE",
          createdAt: nowIso,
          updatedAt: nowIso,
        }),
      PersistenceConflictError,
    );
  });

  it("keeps sandbox and production consents isolated", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const nowIso = now();
    await db.consents.save({
      id: "c1",
      provider: "mercadopago",
      environment: "sandbox",
      primaryProviderAccountReference: "owner",
      providerReceiverId: "recv-1",
      recipientId: null,
      status: "ACTIVE",
      invitationReference: null,
      providerCreatedAt: null,
      providerUpdatedAt: null,
      lastCheckedAt: null,
      source: "SMOKE",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await db.consents.save({
      id: "c2",
      provider: "mercadopago",
      environment: "production",
      primaryProviderAccountReference: "owner",
      providerReceiverId: "recv-1",
      recipientId: null,
      status: "ACTIVE",
      invitationReference: null,
      providerCreatedAt: null,
      providerUpdatedAt: null,
      lastCheckedAt: null,
      source: "APPLICATION",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    const sandbox = await db.consents.listActive("sandbox");
    const production = await db.consents.listActive("production");
    assert.equal(sandbox.length, 1);
    assert.equal(production.length, 1);
  });

  it("requires ACTIVE consent listing filter", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const nowIso = now();
    await db.consents.save({
      id: "c1",
      provider: "mercadopago",
      environment: "sandbox",
      primaryProviderAccountReference: "owner",
      providerReceiverId: "recv-pending",
      recipientId: null,
      status: "PENDING",
      invitationReference: null,
      providerCreatedAt: null,
      providerUpdatedAt: null,
      lastCheckedAt: null,
      source: "SMOKE",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    assert.equal((await db.consents.listActive("sandbox")).length, 0);
  });

  it("enforces intent external reference uniqueness", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const nowIso = now();
    await db.intents.save({
      id: "i1",
      sourceProduct: "dnx",
      externalReference: "smoke:1",
      currency: "ARS",
      totalMinor: 1000n,
      status: "DRAFT",
      environment: "sandbox",
      isTestFixture: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await assert.rejects(
      () =>
        db.intents.save({
          id: "i2",
          sourceProduct: "dnx",
          externalReference: "smoke:1",
          currency: "ARS",
          totalMinor: 1000n,
          status: "DRAFT",
          environment: "sandbox",
          isTestFixture: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        }),
      PersistenceConflictError,
    );
  });

  it("enforces provider order uniqueness", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const nowIso = now();
    await db.providerOrders.save({
      id: "po1",
      paymentOrderId: "pay1",
      provider: "mercadopago",
      environment: "sandbox",
      providerOrderId: "ord_1",
      mappedStatus: "PENDING",
      totalMinor: 1000n,
      currency: "ARS",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await assert.rejects(
      () =>
        db.providerOrders.save({
          id: "po2",
          paymentOrderId: "pay1",
          provider: "mercadopago",
          environment: "sandbox",
          providerOrderId: "ord_1",
          mappedStatus: "PENDING",
          totalMinor: 1000n,
          currency: "ARS",
          createdAt: nowIso,
          updatedAt: nowIso,
        }),
      PersistenceConflictError,
    );
  });

  it("requires exactly one owner and at least one partner", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const nowIso = now();
    await assert.rejects(
      () =>
        db.providerSplits.saveMany([
          {
            id: "s1",
            providerOrderId: "po1",
            recipientId: "r1",
            providerReceiverReference: "owner",
            receiverType: "OWNER",
            amountMinor: 700n,
            currency: "ARS",
            status: "PLANNED",
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ]),
      PersistenceConflictError,
    );
  });

  it("keeps splits immutable", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const nowIso = now();
    const splits = [
      {
        id: "s1",
        providerOrderId: "po1",
        recipientId: "r1",
        providerReceiverReference: "owner",
        receiverType: "OWNER" as const,
        amountMinor: 700n,
        currency: "ARS" as const,
        status: "PLANNED" as const,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: "s2",
        providerOrderId: "po1",
        recipientId: "r2",
        providerReceiverReference: "partner",
        receiverType: "PARTNER" as const,
        amountMinor: 300n,
        currency: "ARS" as const,
        status: "PLANNED" as const,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
    await db.providerSplits.saveMany(splits);
    await assert.rejects(() => db.providerSplits.saveMany(splits), ImmutableSplitError);
  });

  it("idempotency same payload recovers", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const nowIso = now();
    const first = await db.idempotency.reserve({
      id: "idemp1",
      operation: "create_order",
      provider: "mercadopago",
      environment: "sandbox",
      idempotencyKey: "k1",
      payloadHash: "hash-a",
      now: nowIso,
    });
    assert.equal(first.kind, "CREATED");
    const second = await db.idempotency.reserve({
      id: "idemp2",
      operation: "create_order",
      provider: "mercadopago",
      environment: "sandbox",
      idempotencyKey: "k1",
      payloadHash: "hash-a",
      now: nowIso,
    });
    assert.equal(second.kind, "SAME_PAYLOAD");
  });

  it("idempotency different payload conflicts", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const nowIso = now();
    await db.idempotency.reserve({
      id: "idemp1",
      operation: "create_order",
      provider: "mercadopago",
      environment: "sandbox",
      idempotencyKey: "k1",
      payloadHash: "hash-a",
      now: nowIso,
    });
    const conflict = await db.idempotency.reserve({
      id: "idemp2",
      operation: "create_order",
      provider: "mercadopago",
      environment: "sandbox",
      idempotencyKey: "k1",
      payloadHash: "hash-b",
      now: nowIso,
    });
    assert.equal(conflict.kind, "CONFLICT");
  });

  it("webhook duplicate and retry", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const nowIso = now();
    const base = {
      id: "w1",
      provider: "mercadopago" as const,
      environment: "sandbox" as const,
      eventType: "order",
      providerEventId: "evt-1",
      providerResourceId: "ord-1",
      rawBodyHash: "body",
      receivedAt: nowIso,
      processingStatus: "RECEIVED" as const,
      attempts: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const first = await db.webhooks.ingest(base);
    assert.equal(first.kind, "INSERTED");
    const dup = await db.webhooks.ingest({ ...base, id: "w2" });
    assert.equal(dup.kind, "DUPLICATE");
    await db.webhooks.markProcessing("w1", nowIso);
    await db.webhooks.markFailed("w1", "TMP", nowIso);
    const failed = await db.webhooks.findById("w1");
    assert.equal(failed?.processingStatus, "FAILED");
    assert.equal(failed?.attempts, 1);
  });

  it("audit is append-only and sanitized", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    await db.audit.append({
      id: "a1",
      actorType: "system",
      action: "smoke",
      aggregateType: "order",
      aggregateId: "o1",
      result: "SUCCEEDED",
      metadata: { accessToken: "TEST-secret", deviceId: "dev-1", ok: "yes" },
      createdAt: now(),
    });
    const events = await db.audit.list({ aggregateId: "o1" });
    assert.equal(events.length, 1);
    assert.equal(events[0]!.metadata?.accessToken, "[REDACTED]");
    assert.equal(events[0]!.metadata?.deviceId, "[REDACTED]");
    assert.equal(events[0]!.metadata?.ok, "yes");
  });

  it("transactions create intent + reserve + register provider order", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const nowIso = now();
    await db.recipients.save({
      id: "owner",
      recipientType: "PLATFORM",
      status: "ACTIVE",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await db.recipients.save({
      id: "partner",
      recipientType: "PHOTOGRAPHER",
      status: "ACTIVE",
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await createIntentUnit(db, {
      intent: {
        id: "intent1",
        sourceProduct: "dnx",
        externalReference: "ext-1",
        currency: "ARS",
        totalMinor: 1000n,
        status: "READY",
        environment: "sandbox",
        isTestFixture: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      audit: {
        id: "aud1",
        actorType: "system",
        action: "intent.create",
        aggregateType: "payment_intent",
        aggregateId: "intent1",
        result: "SUCCEEDED",
        createdAt: nowIso,
      },
    });

    const record = await reserveIdempotencyUnit(db, {
      reserve: {
        id: "idemp1",
        operation: "create_order",
        provider: "mercadopago",
        environment: "sandbox",
        idempotencyKey: "k-order",
        payloadHash: "ph",
        now: nowIso,
      },
      order: {
        id: "payord1",
        paymentIntentId: "intent1",
        provider: "mercadopago",
        environment: "sandbox",
        status: "AWAITING_PROVIDER",
        amountMinor: 1000n,
        currency: "ARS",
        ownerRecipientId: "owner",
        isTestFixture: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      audit: {
        id: "aud2",
        actorType: "system",
        action: "idempotency.reserve",
        aggregateType: "payment_order",
        aggregateId: "payord1",
        result: "SUCCEEDED",
        createdAt: nowIso,
      },
    });

    assertHttpOutsideTransaction();

    await registerProviderOrderUnit(db, {
      providerOrder: {
        id: "prov1",
        paymentOrderId: "payord1",
        provider: "mercadopago",
        environment: "sandbox",
        providerOrderId: "mp-ord-1",
        mappedStatus: "UNKNOWN",
        totalMinor: 1000n,
        currency: "ARS",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      splits: [
        {
          id: "s1",
          providerOrderId: "prov1",
          recipientId: "owner",
          providerReceiverReference: "owner-ref",
          receiverType: "OWNER",
          amountMinor: 700n,
          currency: "ARS",
          status: "SUBMITTED",
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          id: "s2",
          providerOrderId: "prov1",
          recipientId: "partner",
          providerReceiverReference: "partner-ref",
          receiverType: "PARTNER",
          amountMinor: 300n,
          currency: "ARS",
          status: "SUBMITTED",
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      idempotencyId: record.id,
      now: nowIso,
      audit: {
        id: "aud3",
        actorType: "system",
        action: "provider_order.register",
        aggregateType: "provider_order",
        aggregateId: "prov1",
        result: "SUCCEEDED",
        createdAt: nowIso,
      },
    });

    const stored = await db.idempotency.find("mercadopago", "sandbox", "k-order");
    assert.equal(stored?.status, "SUCCEEDED");
    assert.equal((await db.providerSplits.listByProviderOrderId("prov1")).length, 2);
  });

  it("sanitizes secrets in snapshots", () => {
    const sanitized = sanitizeMetadata({
      token: "TEST-x",
      pan: "411111",
      safe: "ok",
    });
    assert.equal(sanitized?.token, "[REDACTED]");
    assert.equal(sanitized?.pan, "[REDACTED]");
    assert.equal(sanitized?.safe, "ok");
  });

  it("maps prisma enums without secrets", () => {
    assert.equal(mapProviderToPrisma("mercadopago"), "MERCADOPAGO");
    assert.equal(mapEnvToPrisma("sandbox"), "SANDBOX");
  });

  it("prisma adapter wires against fake delegates", async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const fake = {
      dnxPaymentRecipient: {
        async upsert(args: { where: { id: string }; create: Record<string, unknown> }) {
          rows.set(args.where.id, args.create);
        },
        async findUnique(args: { where: { id: string } }) {
          return rows.get(args.where.id) ?? null;
        },
        async findMany() {
          return [...rows.values()];
        },
      },
      dnxProviderRecipientAccount: {
        async upsert() {},
        async findUnique() {
          return null;
        },
        async findFirst() {
          return null;
        },
      },
      dnxSplitConsent: {
        async upsert() {},
        async findUnique() {
          return null;
        },
        async findMany() {
          return [];
        },
      },
      dnxPaymentIntent: {
        async upsert() {},
        async findUnique() {
          return null;
        },
      },
      dnxPaymentOrder: {
        async upsert() {},
        async findUnique() {
          return null;
        },
      },
      dnxProviderOrder: {
        async upsert() {},
        async findUnique() {
          return null;
        },
      },
      dnxProviderSplit: {
        async createMany() {},
        async findMany() {
          return [];
        },
        async count() {
          return 0;
        },
      },
      dnxPaymentIdempotencyRecord: {
        async findUnique() {
          return null;
        },
        async create(args: { data: Record<string, unknown> }) {
          return args.data;
        },
        async update() {},
      },
      dnxPaymentWebhookInbox: {
        async findUnique() {
          return null;
        },
        async create(args: { data: Record<string, unknown> }) {
          return args.data;
        },
        async update() {},
      },
      dnxPaymentAuditEvent: {
        async create() {},
        async findMany() {
          return [];
        },
      },
    };

    const db = createPrismaDnxPaymentsPersistence(
      fake as unknown as import("../../infrastructure/prisma/index.js").DnxPaymentsPrismaDelegates,
    );
    const nowIso = now();
    await db.recipients.save({
      id: "r-prisma",
      recipientType: "PLATFORM",
      status: "ACTIVE",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    const found = await db.recipients.findById("r-prisma");
    assert.equal(found?.id, "r-prisma");
  });

  it("cleanup fixtures flag is queryable", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const nowIso = now();
    await db.intents.save({
      id: "i-fix",
      sourceProduct: "dnx",
      externalReference: "fixture",
      currency: "ARS",
      totalMinor: 100n,
      status: "DRAFT",
      environment: "sandbox",
      isTestFixture: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    const intent = await db.intents.findById("i-fix");
    assert.equal(intent?.isTestFixture, true);
  });
});
