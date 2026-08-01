import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { loadSandboxEnvFromProcess } from "../sandbox/preflight.js";
import {
  createMercadoPagoProviderConfig,
  MP_API_BASE_URL,
  singleIntangibleItem,
  buildMercadoPagoSplitOrderRequest,
  buildSplitEntriesFromDistribution,
  resolveMpAmountType,
  validateMercadoPagoSplitOrder,
} from "../providers/mercado-pago/index.js";
import { money } from "../money/index.js";
import { calculateDistribution } from "../distribution/index.js";

async function main() {
  const env = loadSandboxEnvFromProcess(process.env, {
    cwd: resolve(process.cwd(), "../.."),
  });
  const total = money("ARS", 10_000n);
  const multi = process.argv.includes("--multi");
  const rules = multi
    ? [
        {
          recipientId: "owner",
          role: "OTHER" as const,
          kind: "PERCENTAGE" as const,
          percentageBps: 3400,
          priority: 1,
          optional: false,
        },
        {
          recipientId: "partner_a",
          role: "OTHER" as const,
          kind: "PERCENTAGE" as const,
          percentageBps: 3300,
          priority: 2,
          optional: false,
        },
        {
          recipientId: "partner_b",
          role: "OTHER" as const,
          kind: "PERCENTAGE" as const,
          percentageBps: 3300,
          priority: 3,
          optional: false,
        },
      ]
    : [
        {
          recipientId: "owner",
          role: "OTHER" as const,
          kind: "PERCENTAGE" as const,
          percentageBps: 5000,
          priority: 1,
          optional: false,
        },
        {
          recipientId: "partner_a",
          role: "OTHER" as const,
          kind: "PERCENTAGE" as const,
          percentageBps: 5000,
          priority: 2,
          optional: false,
        },
      ];
  const distribution = calculateDistribution({
    total,
    rules,
    rounding: "LARGEST_REMAINDER",
    eligibleRecipientIds: rules.map((r) => r.recipientId),
  });
  const partnerReceiverIds = new Map<string, string>([
    ["partner_a", env.partnerReceiverId!],
    ...(multi && env.partnerReceiverId2
      ? ([["partner_b", env.partnerReceiverId2]] as const)
      : []),
  ]);
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
  const amountType = resolveMpAmountType(distribution, "fixed_preferred");
  const entries = buildSplitEntriesFromDistribution(
    distribution,
    env.ownerUserId!,
    partnerReceiverIds,
    { partnerConsentsByRecipientId, amountType },
  );
  const validated = validateMercadoPagoSplitOrder({
    externalReference: `imp05raw-${randomUUID().slice(0, 8)}`,
    total,
    amountType,
    entries,
    deviceSessionId: env.deviceId!,
    payerEmail: "buyer.imp05@testuser.com",
    statementDescriptor: "DNXTEST",
    defaultStatementDescriptor: "DNXTEST",
    items: [
      singleIntangibleItem({
        title: "Imp05 debug",
        total,
        categoryId: "others",
        id: "dbg",
      }),
    ],
    itemsTotalRelation: "informative",
    partnerReceiverIds,
    partnerConsentsByRecipientId,
    ownerUserId: env.ownerUserId!,
    allowTestFixtures: false,
  });
  const built = buildMercadoPagoSplitOrderRequest({
    externalReference: validated.externalReference,
    total,
    amountType,
    entries,
    deviceSessionId: validated.deviceSessionId,
    payerEmail: validated.payerEmail,
    statementDescriptor: validated.statementDescriptor,
    items: [
      singleIntangibleItem({
        title: "Imp05 debug",
        total,
        categoryId: "others",
        id: "dbg",
      }),
    ],
    paymentToken: env.paymentToken!,
    paymentMethodId:
      process.env.MERCADOPAGO_TEST_PAYMENT_METHOD_ID?.trim() || "master",
    installments: 1,
  });

  const bodyShape = {
    keys: Object.keys(built.body),
    type: (built.body as { type?: string }).type,
    hasPayer: Boolean((built.body as { payer?: unknown }).payer),
    hasItems: Boolean((built.body as { items?: unknown }).items),
    hasSplits: Boolean((built.body as { splits?: unknown }).splits),
    hasTransactions: Boolean((built.body as { transactions?: unknown }).transactions),
    splitCount: Array.isArray((built.body as { splits?: unknown[] }).splits)
      ? (built.body as { splits: unknown[] }).splits.length
      : 0,
    amountType: (built.body as { config?: { split_rules?: { amount_type?: string } } })
      .config?.split_rules?.amount_type,
    externalReferencePresent: Boolean(
      (built.body as { external_reference?: string }).external_reference,
    ),
    statementInPaymentMethod: false,
  };

  const res = await fetch(`${MP_API_BASE_URL}/v1/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": randomUUID(),
      "x-test-token": "true",
      ...built.headers,
    },
    body: JSON.stringify(built.body),
  });
  const rawText = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = null;
  }
  const record = parsed as Record<string, unknown> | null;
  const orderId = typeof record?.id === "string" ? record.id : null;
  const status = typeof record?.status === "string" ? record.status : null;
  const statusDetail =
    typeof record?.status_detail === "string" ? record.status_detail : null;
  console.log(
    JSON.stringify(
      {
        httpStatus: res.status,
        bodyShape,
        orderIdPrefix: orderId ? `${orderId.slice(0, 8)}…` : null,
        status,
        statusDetail,
        totalAmount: typeof record?.total_amount === "string" ? record.total_amount : null,
        splitCountObserved: Array.isArray(record?.splits)
          ? (record.splits as unknown[]).length
          : null,
        errorTitle:
          typeof record?.title === "string"
            ? record.title
            : typeof record?.message === "string"
              ? record.message
              : null,
        errorCode:
          typeof record?.code === "string"
            ? record.code
            : typeof record?.error === "string"
              ? record.error
              : null,
        errorDetail:
          typeof record?.detail === "string"
            ? record.detail.slice(0, 400)
            : typeof record?.message === "string"
              ? record.message.slice(0, 400)
              : null,
        causes: Array.isArray(record?.causes)
          ? record.causes.slice(0, 5)
          : Array.isArray(record?.errors)
            ? record.errors.slice(0, 5)
            : null,
        rawKeys: record ? Object.keys(record).slice(0, 20) : [],
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ fatal: String(e).slice(0, 200) }));
  process.exitCode = 1;
});
