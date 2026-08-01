import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { loadSandboxEnvFromProcess } from "../sandbox/preflight.js";
import {
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  singleIntangibleItem,
} from "../providers/mercado-pago/index.js";
import { money } from "../money/index.js";
import { calculateDistribution } from "../distribution/index.js";

async function tryCreate(
  label: string,
  withToken: boolean,
  opts: {
    adapter: MercadoPagoOrdersAdapter;
    env: ReturnType<typeof loadSandboxEnvFromProcess>;
  },
) {
  const total = money("ARS", 10_000n);
  const distribution = calculateDistribution({
    total,
    rules: [
      {
        recipientId: "owner",
        role: "OTHER",
        kind: "PERCENTAGE",
        percentageBps: 5000,
        priority: 1,
        optional: false,
      },
      {
        recipientId: "partner_a",
        role: "OTHER",
        kind: "PERCENTAGE",
        percentageBps: 5000,
        priority: 2,
        optional: false,
      },
    ],
    rounding: "LARGEST_REMAINDER",
    eligibleRecipientIds: ["owner", "partner_a"],
  });
  const evidence = {
    receiverId: opts.env.partnerReceiverId!,
    status: "ACTIVE" as const,
    provider: "mercadopago" as const,
  };
  try {
    const created = await opts.adapter.createSplitOrder({
      environment: "sandbox",
      externalReference: `imp05dbg-${label}-${randomUUID().slice(0, 8)}`,
      total,
      distribution,
      idempotencyKey: randomUUID(),
      deviceSessionId: opts.env.deviceId!,
      ...(withToken
        ? {
            paymentToken: opts.env.paymentToken!,
            paymentMethodId: "visa",
            installments: 1,
          }
        : {}),
      payerEmail: "buyer.imp05@testuser.com",
      statementDescriptor: "DNXTEST",
      items: [
        singleIntangibleItem({
          title: "Imp05 debug",
          total,
          categoryId: "others",
          id: "dbg",
        }),
      ],
      partnerReceiverIds: new Map([["partner_a", opts.env.partnerReceiverId!]]),
      partnerConsentsByRecipientId: new Map([["partner_a", evidence]]),
      metadata: { stage: "IMP05DBG" },
    });
    console.log(
      JSON.stringify({
        label,
        withToken,
        ok: true,
        status: created.status,
        idPrefix: created.providerOrderId.slice(0, 12),
      }),
    );
  } catch (e: unknown) {
    const err = e as {
      name?: string;
      code?: string;
      statusCode?: number;
      message?: string;
      cause?: unknown;
    };
    console.log(
      JSON.stringify({
        label,
        withToken,
        ok: false,
        name: err.name ?? null,
        code: err.code ?? null,
        statusCode: err.statusCode ?? null,
        message: String(err.message ?? e).slice(0, 400),
      }),
    );
  }
}

async function main() {
  const env = loadSandboxEnvFromProcess(process.env, {
    cwd: resolve(process.cwd(), "../.."),
  });
  const config = createMercadoPagoProviderConfig({
    accessToken: env.accessToken!,
    environment: "sandbox",
  });
  const http = new MercadoPagoHttpClient(config);
  const adapter = new MercadoPagoOrdersAdapter({
    config,
    ownerUserId: env.ownerUserId!,
    httpClient: http,
    verifyAfterCreate: false,
    allowTestFixtures: false,
    enforceOrders1nStagingGate: false,
    defaultStatementDescriptor: "DNXTEST",
  });
  await tryCreate("no_token", false, { adapter, env });
  await tryCreate("with_token", true, { adapter, env });
}

main();
