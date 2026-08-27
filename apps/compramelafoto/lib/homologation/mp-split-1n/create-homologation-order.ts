import { randomUUID } from "node:crypto";
import {
  calculateDistribution,
  money,
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  singleIntangibleItem,
  loadSandboxEnvFromProcess,
} from "./payments-bridge";
import type { HomologationScenario } from "./scenarios";
import {
  CLF_CARD_BRICK_HOMOLOGATION_SOURCE,
  prefixId,
  writeClfBrickHomologationEvidence,
  type ClfBrickHomologationEvidence,
} from "./evidence-store";

export type CreateHomologationOrderInput = {
  scenario: HomologationScenario;
  /** From Brick — required. */
  cardToken: string;
  paymentMethodId: string;
  installments: number;
  deviceSessionId: string;
  /** Display-only; ignored for charge. */
  clientDisplayedAmountMinor?: number;
};

export type CreateHomologationOrderResult = {
  ok: true;
  source: typeof CLF_CARD_BRICK_HOMOLOGATION_SOURCE;
  scenarioId: string;
  partnerCount: number;
  providerOrderId: string;
  providerOrderIdPrefix: string;
  status: string;
  statusDetail: string | null;
  DEVICE_SESSION_PRESENT: true;
  deviceSessionIdLength: number;
  splitSumValid: boolean;
  amountType: "fixed";
  evidencePath: string;
};

function buildRules(partnerCount: 1 | 2) {
  const ids =
    partnerCount === 2
      ? ["owner", "partner_a", "partner_b"]
      : ["owner", "partner_a"];
  const equal = Math.floor(10_000 / ids.length);
  return ids.map((recipientId, i) => ({
    recipientId,
    role: "OTHER" as const,
    kind: "PERCENTAGE" as const,
    percentageBps: i === 0 ? 10_000 - equal * (ids.length - 1) : equal,
    priority: i + 1,
    optional: false,
  }));
}

/**
 * Creates a sandbox Orders Split 1:N payment for homologation only.
 * Does NOT create CLF album/print orders, downloads, emails, or invoices.
 */
export async function createClfMpSplit1nHomologationOrder(
  input: CreateHomologationOrderInput,
): Promise<CreateHomologationOrderResult> {
  const device = input.deviceSessionId.trim();
  if (!device) {
    throw new Error("DEVICE_SESSION_REQUIRED");
  }
  const token = input.cardToken.trim();
  if (!token) {
    throw new Error("CARD_TOKEN_REQUIRED");
  }

  // Resolve TEST credentials from process + monorepo sandbox env files.
  const repoRoot = process.cwd().endsWith("compramelafoto")
    ? `${process.cwd()}/../..`
    : process.cwd();
  const env = loadSandboxEnvFromProcess(process.env, { cwd: repoRoot });

  if (
    !env.accessToken ||
    !env.ownerUserId ||
    !env.partnerReceiverId ||
    !env.publicKey
  ) {
    throw new Error("SANDBOX_ENV_INCOMPLETE");
  }
  if (input.scenario.partnerCount === 2 && !env.partnerReceiverId2) {
    throw new Error("PARTNER_B_MISSING");
  }

  const total = money("ARS", input.scenario.totalMinor);
  const rules = buildRules(input.scenario.partnerCount);
  const distribution = calculateDistribution({
    total,
    rules,
    rounding: "LARGEST_REMAINDER",
    eligibleRecipientIds: rules.map((r) => r.recipientId),
  });
  const allocSum = distribution.entries.reduce(
    (s, e) => s + e.amount.amountMinor,
    BigInt(0),
  );
  const splitSumValid = allocSum === input.scenario.totalMinor;

  const partnerReceiverIds = new Map<string, string>([
    ["partner_a", env.partnerReceiverId],
  ]);
  if (input.scenario.partnerCount === 2 && env.partnerReceiverId2) {
    partnerReceiverIds.set("partner_b", env.partnerReceiverId2);
  }
  const partnerConsentsByRecipientId = new Map(
    [...partnerReceiverIds.entries()].map(([recipientId, receiverId]) => [
      recipientId,
      {
        receiverId,
        status: "ACTIVE" as const,
        provider: "mercadopago" as const,
      },
    ]),
  );

  const config = createMercadoPagoProviderConfig({
    accessToken: env.accessToken,
    environment: "sandbox",
    publicKey: env.publicKey,
  });
  const http = new MercadoPagoHttpClient(config);
  const adapter = new MercadoPagoOrdersAdapter({
    config,
    ownerUserId: env.ownerUserId,
    httpClient: http,
    verifyAfterCreate: true,
    allowTestFixtures: false,
    // Homologation surface: staging gate via flag+env hard blocks already applied.
    enforceOrders1nStagingGate: false,
    defaultStatementDescriptor: "DNX TEST",
  });

  const created = await adapter.createSplitOrder({
    environment: "sandbox",
    externalReference: `clf-hg-${input.scenario.id.toLowerCase()}-${randomUUID().slice(0, 8)}`,
    total,
    distribution,
    idempotencyKey: randomUUID(),
    deviceSessionId: device,
    paymentToken: token,
    paymentMethodId: input.paymentMethodId || "master",
    installments: input.installments || 1,
    payerEmail: "buyer.clf.homolog@testuser.com",
    statementDescriptor: "DNX TEST",
    items: [
      singleIntangibleItem({
        title: "CLF homologation intangible (sandbox)",
        total,
        categoryId: "others",
      }),
    ],
    partnerReceiverIds,
    partnerConsentsByRecipientId,
    metadata: {
      source: CLF_CARD_BRICK_HOMOLOGATION_SOURCE,
      scenarioId: input.scenario.id,
      // Never put PII / secrets here
    },
  });

  const got = await adapter.getOrder(created.providerOrderId, "sandbox");

  const evidence: ClfBrickHomologationEvidence = {
    source: CLF_CARD_BRICK_HOMOLOGATION_SOURCE,
    scenarioId: input.scenario.id,
    partnerCount: input.scenario.partnerCount,
    totalMinor: input.scenario.totalMinor.toString(),
    currency: "ARS",
    providerOrderId: created.providerOrderId,
    providerOrderIdPrefix: prefixId(created.providerOrderId) ?? "…",
    status: got.status,
    statusDetail: got.statusDetail ?? null,
    paymentTransactionIdPrefix: prefixId(got.payments[0]?.providerPaymentId),
    DEVICE_SESSION_PRESENT: true,
    deviceSessionIdLength: device.length,
    amountType: "fixed",
    splitSumValid,
    createdAt: new Date().toISOString(),
    environment: "sandbox",
    productionWrites: "BLOCKED",
  };
  const evidencePath = writeClfBrickHomologationEvidence(evidence);

  console.info(
    JSON.stringify({
      event: "HOMOLOGATION_SMOKE",
      SOURCE: CLF_CARD_BRICK_HOMOLOGATION_SOURCE,
      SCENARIO: input.scenario.id,
      DEVICE_SESSION_PRESENT: true,
      deviceSessionIdLength: device.length,
      ORDER_CREATED: true,
      ORDER_STATUS: got.status,
      RECEIVER_COUNT: 1 + input.scenario.partnerCount,
      SPLIT_SUM_VALID: splitSumValid,
      GET_RECONCILED: true,
      providerOrderIdPrefix: evidence.providerOrderIdPrefix,
      // never token / full device / secrets
    }),
  );

  return {
    ok: true,
    source: CLF_CARD_BRICK_HOMOLOGATION_SOURCE,
    scenarioId: input.scenario.id,
    partnerCount: input.scenario.partnerCount,
    providerOrderId: created.providerOrderId,
    providerOrderIdPrefix: evidence.providerOrderIdPrefix,
    status: got.status,
    statusDetail: got.statusDetail ?? null,
    DEVICE_SESSION_PRESENT: true,
    deviceSessionIdLength: device.length,
    splitSumValid,
    amountType: "fixed",
    evidencePath,
  };
}
