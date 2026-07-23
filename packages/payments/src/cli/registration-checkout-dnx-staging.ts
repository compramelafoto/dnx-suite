#!/usr/bin/env node
/**
 * 10D3I-H — Registration checkout ↔ DNX Payments ↔ Orders 1:N staging.
 *
 * Modes:
 *   --preflight | --local-integration | --e2e-sandbox | --rollback-flags-off
 *
 * Requires --confirm-staging --confirm-orders-test for live create.
 * Always rolls flags OFF on exit (finally).
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  loadSandboxEnvFromProcess,
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  isSandboxAccessToken,
  createInMemoryDnxPaymentsPersistence,
  createClickatonCheckoutService,
  createMercadoPagoOrders1nClickatonBridge,
  buildClickatonOperationalSnapshot,
  fulfillRegistrationFromOrdersObserve,
  observeOrdersWebhook,
  buildOrdersWebhookFixtureBody,
  signMercadoPagoTestWebhook,
  mapMercadoPagoOrderResponse,
  ORDERS_1N_STAGING_FLAG,
  ORDERS_1N_WEBHOOK_OBSERVE_FLAG,
  CLICKATON_DNX_CHECKOUT_FLAG,
  isOrders1nStagingFlagEnabled,
  isOrders1nWebhookObserveEnabled,
  isClickatonDnxCheckoutEnabled,
} from "../index.js";
import { assertFinancialIdentityStagingHost } from "./staging-host-gate.js";

type Mode = "preflight" | "local-integration" | "e2e-sandbox" | "rollback-flags-off";

function parseArgs(argv: string[]) {
  const args = {
    mode: "preflight" as Mode,
    confirmStaging: false,
    confirmOrdersTest: false,
    reportDir: ".local/audit-10d3i-h",
  };
  for (const a of argv) {
    if (a === "--preflight") args.mode = "preflight";
    if (a === "--local-integration") args.mode = "local-integration";
    if (a === "--e2e-sandbox") args.mode = "e2e-sandbox";
    if (a === "--rollback-flags-off") args.mode = "rollback-flags-off";
    if (a === "--confirm-staging") args.confirmStaging = true;
    if (a === "--confirm-orders-test") args.confirmOrdersTest = true;
    if (a.startsWith("--report-dir=")) args.reportDir = a.slice("--report-dir=".length);
  }
  return args;
}

function writeReport(dir: string, name: string, body: unknown): string {
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, name);
  writeFileSync(path, JSON.stringify(body, null, 2));
  return path;
}

function prefix(value: string | undefined | null, n = 10): string | null {
  if (!value) return null;
  return value.length <= n ? `${value.slice(0, 2)}…` : `${value.slice(0, n)}…`;
}

function loadMcpEnv(repoRoot: string) {
  const envPath = resolve(repoRoot, "services/dnx-mcp/.env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i);
    const v = t.slice(i + 1);
    if (!(k in process.env) || !process.env[k]) process.env[k] = v;
  }
}

function parseAmountToMinor(amount: string | undefined): string | null {
  if (!amount) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return String(Math.round(n * 100));
}

function rollbackFlagsOff() {
  process.env[CLICKATON_DNX_CHECKOUT_FLAG] = "false";
  process.env[ORDERS_1N_STAGING_FLAG] = "false";
  process.env[ORDERS_1N_WEBHOOK_OBSERVE_FLAG] = "false";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(process.cwd());
  // When run via pnpm --filter, cwd may be packages/payments
  const root = existsSync(resolve(repoRoot, "services/dnx-mcp/.env.local"))
    ? repoRoot
    : resolve(repoRoot, "../..");
  loadMcpEnv(root);
  const reportDir = resolve(root, args.reportDir);

  // Prefer explicit staging Neon URLs over MCP DATABASE_URL (may point elsewhere).
  if (existsSync("/tmp/neon-f-direct.url")) {
    const neon = readFileSync("/tmp/neon-f-direct.url", "utf8").trim();
    if (neon) {
      process.env.DATABASE_URL = neon;
      process.env.DIRECT_URL = neon;
    }
  } else if (existsSync("/tmp/neon-e-pooled.url")) {
    const neon = readFileSync("/tmp/neon-e-pooled.url", "utf8").trim();
    if (neon) {
      process.env.DATABASE_URL = neon;
      process.env.DIRECT_URL = neon;
    }
  }

  try {
    if (args.mode === "rollback-flags-off") {
      rollbackFlagsOff();
      const path = writeReport(reportDir, "rollback_flags.json", {
        checkout: isClickatonDnxCheckoutEnabled(),
        ordersCreate: isOrders1nStagingFlagEnabled(),
        ordersObserve: isOrders1nWebhookObserveEnabled(),
        allOff: true,
      });
      console.log(JSON.stringify({ ok: true, mode: "rollback-flags-off", path }));
      return;
    }

    const gate = assertFinancialIdentityStagingHost();
    const envInput = loadSandboxEnvFromProcess();

    if (args.mode === "preflight") {
      const prisma = new PrismaClient();
      let agreement: unknown = null;
      let migrationCount = 0;
      try {
        migrationCount = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
          `SELECT COUNT(*)::bigint AS c FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
        ).then((r) => Number(r[0]?.c ?? 0));
        agreement = await prisma.dnxEconomicAgreement.findFirst({
          where: {
            productKey: "clickaton",
            scopeType: "STAGING_TEST",
            scopeId: "partners-10d3i-e",
            status: "ACTIVE",
          },
          select: { id: true, status: true },
        });
      } finally {
        await prisma.$disconnect();
      }
      const path = writeReport(reportDir, "preflight.json", {
        hostPrefix: gate.host.slice(0, 28),
        database: gate.database,
        migrationsFinished: migrationCount,
        agreementPresent: Boolean(agreement),
        flags: {
          checkout: isClickatonDnxCheckoutEnabled(),
          ordersCreate: isOrders1nStagingFlagEnabled(),
          ordersObserve: isOrders1nWebhookObserveEnabled(),
        },
        resources: {
          accessToken: Boolean(envInput.accessToken),
          owner: Boolean(envInput.ownerUserId),
          receiver1: Boolean(envInput.partnerReceiverId),
          receiver2: Boolean(envInput.partnerReceiverId2),
          deviceId: Boolean(envInput.deviceId),
          paymentToken: Boolean(envInput.paymentToken),
        },
      });
      console.log(JSON.stringify({ ok: true, mode: "preflight", path }));
      return;
    }

    if (args.mode === "local-integration") {
      process.env[CLICKATON_DNX_CHECKOUT_FLAG] = "true";
      process.env[ORDERS_1N_STAGING_FLAG] = "true";
      process.env[ORDERS_1N_WEBHOOK_OBSERVE_FLAG] = "true";

      const persistence = createInMemoryDnxPaymentsPersistence();
      const fakeProviderOrderId = `ORDTST_H_${randomBytes(8).toString("hex").toUpperCase()}`;
      const registrationId = `reg_h_${randomBytes(6).toString("hex")}`;
      const amountMinor = 10000;

      const bridge = {
        mode: "mercado_pago_orders_test" as const,
        providerName: "mercadopago" as const,
        async createCheckout(input: {
          externalReference: string;
          amountMinor: number;
          pendingUrl: string;
        }) {
          return {
            checkoutUrl: input.pendingUrl,
            providerOrderId: fakeProviderOrderId,
            rawSanitized: {
              mode: "mercado_pago_orders_test",
              status: "PROCESSED_ACCREDITED",
              externalReference: input.externalReference,
              liveMode: false,
            },
          };
        },
      };

      const service = createClickatonCheckoutService(persistence, {
        providerBridge: bridge,
      });

      const payloadHash = createHash("sha256")
        .update(`h-local:${registrationId}:${amountMinor}`)
        .digest("hex");
      const created = await service.createOrder({
        sourceApp: "CLICKATON",
        sourceType: "REGISTRATION",
        sourceId: registrationId,
        idempotencyKey: `h-local-${registrationId}`,
        payloadHash,
        amountMinor,
        currency: "ARS",
        description: "10D3I-H local integration",
        successUrl: "https://clickaton.test/pago/exito",
        pendingUrl: "https://clickaton.test/pago/pendiente",
        failureUrl: "https://clickaton.test/pago/error",
        isTestFixture: true,
      });
      if (created.outcome === "conflict") throw new Error(created.message);
      const order = created.order;

      const webhookSecret =
        process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET?.trim() ||
        `test_wh_${randomBytes(12).toString("hex")}`;
      const body = buildOrdersWebhookFixtureBody({
        providerOrderId: fakeProviderOrderId,
        liveMode: false,
        action: "order.processed",
      });
      const requestId = randomUUID();
      const signed = signMercadoPagoTestWebhook({
        secret: webhookSecret,
        dataId: fakeProviderOrderId,
        requestId,
      });
      const observed = await observeOrdersWebhook({
        headers: {
          "x-signature": signed.signatureHeader,
          "x-request-id": requestId,
        },
        rawBody: body,
        webhookSecret,
        persistence,
        allowCliBypass: true,
        deliveryClass: "SIGNED_REPLAY_OF_SANDBOX_ORDER",
        environment: "sandbox",
        fetchCanonicalOrder: async () => ({
          providerOrderId: fakeProviderOrderId,
          status: "PROCESSED_ACCREDITED",
          statusDetail: "accredited",
          externalReference: `clickaton:registration:${registrationId}`,
          totalMinor: String(amountMinor),
          currency: "ARS",
          splitAmounts: ["3400", "3300", "3300"],
          paymentCount: 1,
        }),
      });
      if (!observed.ok) throw new Error(`observe failed: ${observed.code}`);

      const fulfill = await fulfillRegistrationFromOrdersObserve({
        observe: observed,
        persistence,
        applyNormalizedEvent: (e) => service.applyNormalizedEvent(e),
        checkoutFlagEnabled: true,
      });

      const reuse = await service.createOrder({
        sourceApp: "CLICKATON",
        sourceType: "REGISTRATION",
        sourceId: registrationId,
        idempotencyKey: `h-local-${registrationId}`,
        payloadHash,
        amountMinor,
        currency: "ARS",
        description: "10D3I-H local integration",
        successUrl: "https://clickaton.test/pago/exito",
        pendingUrl: "https://clickaton.test/pago/pendiente",
        failureUrl: "https://clickaton.test/pago/error",
        isTestFixture: true,
      });

      const path = writeReport(reportDir, "local_integration.json", {
        classification: "LOCAL_INTEGRATION_ONLY",
        orderIdPrefix: prefix(order.id),
        providerOrderIdPrefix: prefix(fakeProviderOrderId),
        createOutcome: created.outcome,
        reuseOutcome: reuse.outcome,
        observeOk: observed.ok,
        fulfill,
        paymentStatusAfter:
          fulfill.fulfilled && fulfill.apply.order
            ? fulfill.apply.order.status
            : null,
      });
      console.log(
        JSON.stringify({
          ok: fulfill.fulfilled && fulfill.apply.outcome !== "conflict",
          mode: "local-integration",
          path,
          classification: "LOCAL_INTEGRATION_ONLY",
        }),
      );
      return;
    }

    // e2e-sandbox
    if (!args.confirmStaging || !args.confirmOrdersTest) {
      throw new Error("e2e-sandbox requires --confirm-staging --confirm-orders-test");
    }
    if (!envInput.accessToken || !isSandboxAccessToken(envInput.accessToken)) {
      throw new Error("ABORT: sandbox access token required");
    }
    if (!envInput.paymentToken) {
      const path = writeReport(reportDir, "e2e_blocked.json", {
        classification: "BLOCKED_BY_PAYMENT_TOKEN",
        reason: "PAYMENT_TOKEN_MISSING_OR_EXPIRED",
      });
      console.log(
        JSON.stringify({
          ok: false,
          mode: "e2e-sandbox",
          classification: "BLOCKED_BY_PAYMENT_TOKEN",
          path,
        }),
      );
      return;
    }
    if (
      !envInput.deviceId ||
      !envInput.ownerUserId ||
      !envInput.partnerReceiverId ||
      !envInput.partnerReceiverId2
    ) {
      throw new Error("ABORT: missing owner/receivers/device");
    }

    process.env[CLICKATON_DNX_CHECKOUT_FLAG] = "true";
    process.env[ORDERS_1N_STAGING_FLAG] = "true";
    process.env[ORDERS_1N_WEBHOOK_OBSERVE_FLAG] = "true";

    const prisma = new PrismaClient();
    try {
      // Prefer existing published edition + active ticket; else create TEST edition.
      let edition = await prisma.clickatonEdition.findFirst({
        where: { OR: [{ slug: "10d3i-h-test" }, { isPublished: true }] },
        orderBy: { updatedAt: "desc" },
      });
      if (!edition) {
        edition = await prisma.clickatonEdition.create({
          data: {
            name: "10D3I-H TEST Edition",
            slug: "10d3i-h-test",
            status: "REGISTRATION_OPEN",
            isPublished: true,
            visibleCodePrefix: "H10",
          },
        });
      }
      let ticket = await prisma.clickatonTicketType.findFirst({
        where: { editionId: edition.id, isActive: true },
      });
      if (!ticket) {
        ticket = await prisma.clickatonTicketType.create({
          data: {
            editionId: edition.id,
            name: "Entrada TEST H",
            code: "H10-TEST",
            priceAmount: 10000,
            currency: "ARS",
            isActive: true,
            holdMinutes: 30,
          },
        });
      }

      let user = await prisma.user.findFirst({
        where: { email: { startsWith: "test_clickaton_h_" } },
        orderBy: { id: "desc" },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `test_clickaton_h_${Date.now()}@testuser.com`,
            name: "Test H Participant",
          },
        });
      }

      const registration = await prisma.clickatonRegistration.create({
        data: {
          editionId: edition.id,
          userId: user.id,
          ticketTypeId: ticket.id,
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
          firstName: "Test",
          lastName: "HOrders",
          email: user.email,
          currency: ticket.currency,
          subtotalAmount: ticket.priceAmount,
          totalAmount: ticket.priceAmount,
          holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
          acceptedTermsAt: new Date(),
        },
      });

      const amountMinor = registration.totalAmount;
      const externalReference = `clickaton:registration:${registration.id}`;

      const snapBefore = await buildClickatonOperationalSnapshot({
        prisma,
        totalMinor: BigInt(amountMinor),
        externalReference,
      });

      // Historical E snapshot must remain
      const eSnap = await prisma.dnxOrderDistributionSnapshot.findFirst({
        where: { externalReference: "clickaton-10d3i-e-sim-order-100000" },
      });

      const config = createMercadoPagoProviderConfig({
        environment: "sandbox",
        accessToken: envInput.accessToken,
      });
      const http = new MercadoPagoHttpClient(config);
      const adapter = new MercadoPagoOrdersAdapter({
        config,
        ownerUserId: envInput.ownerUserId,
        httpClient: http,
        enforceOrders1nStagingGate: true,
        confirmStaging: true,
        confirmOrdersTest: true,
        verifyAfterCreate: true,
      });

      const persistence = createInMemoryDnxPaymentsPersistence();
      const bridge = createMercadoPagoOrders1nClickatonBridge({
        adapter,
        ownerUserId: envInput.ownerUserId,
        partnerReceiverId: envInput.partnerReceiverId,
        partnerReceiverId2: envInput.partnerReceiverId2,
        paymentToken: envInput.paymentToken,
        deviceSessionId: envInput.deviceId,
        confirmStaging: true,
        confirmOrdersTest: true,
      });

      const service = createClickatonCheckoutService(persistence, {
        providerBridge: bridge,
        buildOperationalSnapshot: async (input) =>
          buildClickatonOperationalSnapshot({
            prisma,
            totalMinor: input.totalMinor,
            externalReference: input.externalReference,
            paymentIntentId: input.paymentIntentId,
            paymentOrderId: input.paymentOrderId,
          }),
      });

      const payloadHash = createHash("sha256")
        .update(`h-e2e:${registration.id}:${amountMinor}`)
        .digest("hex");
      let createError: string | undefined;
      let created:
        | Awaited<ReturnType<typeof service.createOrder>>
        | undefined;
      try {
        created = await service.createOrder({
          sourceApp: "CLICKATON",
          sourceType: "REGISTRATION",
          sourceId: registration.id,
          idempotencyKey: `h-e2e-${registration.id}`,
          payloadHash,
          amountMinor,
          currency: "ARS",
          description: `Clickatón H ${edition.slug}`,
          successUrl: "https://clickaton.test/pago/exito",
          pendingUrl: "https://clickaton.test/pago/pendiente",
          failureUrl: "https://clickaton.test/pago/error",
          payerEmail: "test_buyer@testuser.com",
          isTestFixture: true,
        });
      } catch (err) {
        createError =
          err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
      }

      if (!created || created.outcome === "conflict" || createError) {
        const tokenExpired =
          /token|expired|unauthorized|401|403|payment_method|invalid.*card|card_token/i.test(
            createError ?? "",
          ) ||
          /Mercado Pago request failed with status 400/i.test(createError ?? "");
        const path = writeReport(reportDir, "e2e_create.json", {
          created: false,
          error: createError ?? (created && "outcome" in created ? created : null),
          classification: tokenExpired
            ? "BLOCKED_BY_PAYMENT_TOKEN"
            : "BLOQUEADO_ORDEN_NO_CREADA",
          registrationIdPrefix: prefix(registration.id),
          snapBeforePrefix: snapBefore.snapshotIdPrefix,
          eSnapshotIntact: Boolean(eSnap),
          note: tokenExpired
            ? "Payment token is ephemeral; regenerate via MP TEST card form before re-run."
            : undefined,
        });
        console.log(
          JSON.stringify({
            ok: false,
            mode: "e2e-sandbox",
            classification: tokenExpired
              ? "BLOCKED_BY_PAYMENT_TOKEN"
              : "BLOQUEADO_ORDEN_NO_CREADA",
            path,
          }),
        );
        return;
      }

      const order = created.order;
      await prisma.clickatonRegistration.update({
        where: { id: registration.id },
        data: {
          paymentOrderId: order.id,
          paymentProvider: "mercadopago",
          paymentExternalReference: externalReference,
          paymentIdempotencyKey: order.idempotencyKey,
          paymentStatus: "PROCESSING",
        },
      });

      const providerOrderId = order.providerOrderId!;
      const raw = await http.request<{
        id: string;
        status: string;
        status_detail?: string;
        external_reference?: string;
        total_amount?: string;
        currency?: string;
        splits?: Array<{ amount?: string }>;
        transactions?: { payments?: unknown[] };
      }>({ method: "GET", path: `/v1/orders/${providerOrderId}` });
      const body = raw.body;
      const mapped = body?.id ? mapMercadoPagoOrderResponse(body as never) : null;

      const webhookSecret =
        process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET?.trim() ||
        `test_wh_${randomBytes(12).toString("hex")}`;
      const fixture = buildOrdersWebhookFixtureBody({
        providerOrderId,
        liveMode: false,
        action: "order.processed",
      });
      const requestId = randomUUID();
      const signed = signMercadoPagoTestWebhook({
        secret: webhookSecret,
        dataId: providerOrderId,
        requestId,
      });
      const observed = await observeOrdersWebhook({
        headers: {
          "x-signature": signed.signatureHeader,
          "x-request-id": requestId,
        },
        rawBody: fixture,
        webhookSecret,
        persistence,
        allowCliBypass: true,
        deliveryClass: "SIGNED_REPLAY_OF_SANDBOX_ORDER",
        environment: "sandbox",
        fetchCanonicalOrder: async () =>
          mapped
            ? {
                providerOrderId: mapped.providerOrderId,
                status: mapped.status,
                statusDetail: mapped.statusDetail ?? null,
                externalReference: body?.external_reference ?? externalReference,
                totalMinor: parseAmountToMinor(body?.total_amount) ?? String(amountMinor),
                currency: body?.currency ?? "ARS",
                splitAmounts: (body?.splits ?? []).map((s) => String(s.amount ?? "0")),
                paymentCount:
                  body?.transactions?.payments?.length ?? mapped.payments.length,
              }
            : null,
        expected: {
          providerOrderId,
          externalReference,
          totalMinor: String(amountMinor),
        },
      });

      const fulfill = observed.ok
        ? await fulfillRegistrationFromOrdersObserve({
            observe: observed,
            persistence,
            applyNormalizedEvent: (e) => service.applyNormalizedEvent(e),
            checkoutFlagEnabled: true,
          })
        : { fulfilled: false as const, reason: "OBSERVE_NOT_OK" as const };

      // Atomic registration confirm + credential (same as prisma confirmPaid)
      let credentialIdPrefix: string | null = null;
      if (
        fulfill.fulfilled &&
        fulfill.apply.order?.status === "APPROVED"
      ) {
        await prisma.$transaction(async (tx) => {
          const existing = await tx.clickatonRegistration.findUnique({
            where: { id: registration.id },
          });
          if (!existing) throw new Error("registration missing");
          if (existing.status === "CONFIRMED" && existing.paymentStatus === "APPROVED") {
            return;
          }
          const seq = await tx.clickatonEditionSequence.upsert({
            where: { editionId: edition!.id },
            create: { editionId: edition!.id, lastValue: 1 },
            update: { lastValue: { increment: 1 } },
          });
          const visibleCode = `H10-${String(seq.lastValue).padStart(5, "0")}`;
          await tx.clickatonRegistration.update({
            where: { id: registration.id },
            data: {
              status: "CONFIRMED",
              paymentStatus: "APPROVED",
              confirmedAt: new Date(),
              visibleCode,
              sequenceNumber: seq.lastValue,
              paymentOrderId: order.id,
            },
          });
          let credential = await tx.clickatonParticipantCredential.findUnique({
            where: { registrationId: registration.id },
          });
          if (!credential) {
            credential = await tx.clickatonParticipantCredential.create({
              data: {
                registrationId: registration.id,
                status: "ACTIVE",
                publicCode: visibleCode,
              },
            });
          }
          credentialIdPrefix = credential.id.slice(0, 10);
          const qr = await tx.clickatonQrToken.findFirst({
            where: { credentialId: credential.id, status: "ACTIVE" },
          });
          if (!qr) {
            const plaintext = randomBytes(32).toString("base64url");
            await tx.clickatonQrToken.create({
              data: {
                credentialId: credential.id,
                tokenHash: createHash("sha256").update(plaintext).digest("hex"),
                tokenPrefix: plaintext.slice(0, 8),
                status: "ACTIVE",
              },
            });
          }
        });
      }

      // Replay observe → no second credential
      const requestId2 = randomUUID();
      const signed2 = signMercadoPagoTestWebhook({
        secret: webhookSecret,
        dataId: providerOrderId,
        requestId: requestId2,
      });
      const observed2 = await observeOrdersWebhook({
        headers: {
          "x-signature": signed2.signatureHeader,
          "x-request-id": requestId2,
        },
        rawBody: fixture,
        webhookSecret,
        persistence,
        allowCliBypass: true,
        deliveryClass: "SIGNED_REPLAY_OF_SANDBOX_ORDER",
        environment: "sandbox",
      });

      const finalReg = await prisma.clickatonRegistration.findUnique({
        where: { id: registration.id },
        include: {
          credential: { include: { qrTokens: true } },
        },
      });
      const credentialCount = await prisma.clickatonParticipantCredential.count({
        where: { registrationId: registration.id },
      });

      const eSnapAfter = await prisma.dnxOrderDistributionSnapshot.findFirst({
        where: { externalReference: "clickaton-10d3i-e-sim-order-100000" },
      });

      const path = writeReport(reportDir, "e2e_sandbox.json", {
        classification: "E2E_SIGNED_REPLAY",
        orderCreated: true,
        providerOrderIdPrefix: prefix(providerOrderId),
        mpStatus: mapped?.status ?? null,
        observeOk: observed.ok,
        observeOutcome: observed.ok ? observed.outcome : null,
        fulfill,
        registration: {
          idPrefix: prefix(registration.id),
          statusInitial: "PENDING_PAYMENT",
          statusFinal: finalReg?.status ?? null,
          paymentStatusFinal: finalReg?.paymentStatus ?? null,
          paidAt: finalReg?.confirmedAt?.toISOString() ?? null,
        },
        credential: {
          count: credentialCount,
          idPrefix: credentialIdPrefix,
          qrCount: finalReg?.credential?.qrTokens.length ?? 0,
        },
        replay: {
          outcome: observed2.ok ? observed2.outcome : observed2.code,
          credentialStillOne: credentialCount === 1,
        },
        snapshotEIntact: Boolean(eSnapAfter),
        operationalSnapshotPrefix: snapBefore.snapshotIdPrefix,
      });

      console.log(
        JSON.stringify({
          ok:
            finalReg?.status === "CONFIRMED" &&
            finalReg.paymentStatus === "APPROVED" &&
            credentialCount === 1,
          mode: "e2e-sandbox",
          classification: "E2E_SIGNED_REPLAY",
          path,
        }),
      );
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    rollbackFlagsOff();
    writeReport(resolve(root, args.reportDir), "flags_final.json", {
      checkout: isClickatonDnxCheckoutEnabled(),
      ordersCreate: isOrders1nStagingFlagEnabled(),
      ordersObserve: isOrders1nWebhookObserveEnabled(),
      required: "ALL_OFF",
    });
  }
}

main().catch((err) => {
  rollbackFlagsOff();
  console.error(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 240) : String(err).slice(0, 240),
      flagsOff: true,
    }),
  );
  process.exit(1);
});
