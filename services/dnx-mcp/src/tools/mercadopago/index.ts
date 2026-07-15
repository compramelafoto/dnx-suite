import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  buildMercadoPagoSplitOrderRequest,
  calculateDistribution,
  createMercadoPagoProviderConfig,
  isTestAccessToken,
  money,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  MercadoPagoProductionWriteBlockedError,
  MercadoPagoSplitConsentAdapter,
  validateSplitOrderForMercadoPago,
  type RecipientRole,
} from "@repo/payments";
import { loadEnv } from "../../config/index.js";
import {
  audit,
  confirmSchema,
  dryRunSchema,
  jsonResult,
  resolveExecutionGate,
  withAudit,
} from "../shared/index.js";

function tokenMeta() {
  const env = loadEnv();
  const token = env.MERCADOPAGO_ACCESS_TOKEN?.trim() ?? "";
  return {
    present: token.length > 0,
    isTestPrefix: token.length > 0 ? isTestAccessToken(token) : false,
    length: token.length,
  };
}

function requireSandboxHttp() {
  const env = loadEnv();
  const token = env.MERCADOPAGO_ACCESS_TOKEN?.trim() ?? "";
  if (!token || !isTestAccessToken(token)) {
    throw new MercadoPagoProductionWriteBlockedError(
      "MERCADOPAGO_ACCESS_TOKEN must be present and TEST- prefixed for MCP sandbox tools",
    );
  }
  const config = createMercadoPagoProviderConfig({
    environment: "sandbox",
    accessToken: token,
  });
  return { config, http: new MercadoPagoHttpClient(config) };
}

export function registerMercadoPagoTools(server: McpServer): void {
  server.registerTool(
    "mp_split_environment_status",
    {
      title: "MP Split environment status",
      description: "Estado sandbox Mercado Pago Split (nunca expone tokens).",
      inputSchema: { dryRun: dryRunSchema },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object({ dryRun: dryRunSchema }).parse(input);
      return withAudit(
        {
          tool: "mp_split_environment_status",
          action: "status",
          dryRun: parsed.dryRun,
          confirmed: false,
        },
        async () =>
          jsonResult({
            dryRun: parsed.dryRun,
            environment: "sandbox",
            productionWritesAllowed: false,
            credentials: tokenMeta(),
            waitingMpConfirmation: [
              "fee_allocation",
              "seller_primary",
              "taxes_withholdings",
              "settlements_payouts",
            ],
          }),
      );
    },
  );

  server.registerTool(
    "mp_split_validate_distribution",
    {
      title: "Validate distribution plan",
      description: "Valida Distribution Engine localmente (sin HTTP).",
      inputSchema: {
        totalMinor: z.string(),
        currency: z.enum(["ARS", "BRL", "USD", "MXN", "CLP", "UYU"]),
        platformBps: z.number().int().min(1).max(10_000),
        photographerBps: z.number().int().min(1).max(10_000),
        organizerBps: z.number().int().min(1).max(10_000).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z
        .object({
          totalMinor: z.string(),
          currency: z.enum(["ARS", "BRL", "USD", "MXN", "CLP", "UYU"]),
          platformBps: z.number().int(),
          photographerBps: z.number().int(),
          organizerBps: z.number().int().optional(),
        })
        .parse(input);

      return withAudit(
        {
          tool: "mp_split_validate_distribution",
          action: "validate",
          dryRun: false,
          confirmed: false,
        },
        async () => {
          const total = money(parsed.currency, parsed.totalMinor);
          const rules = [
            {
              recipientId: "platform",
              role: "PLATFORM" as RecipientRole,
              kind: "PERCENTAGE" as const,
              percentageBps: parsed.platformBps,
              priority: 1,
            },
            {
              recipientId: "photographer",
              role: "PHOTOGRAPHER" as RecipientRole,
              kind: "PERCENTAGE" as const,
              percentageBps: parsed.photographerBps,
              priority: 2,
            },
          ];
          if (parsed.organizerBps !== undefined) {
            rules.push({
              recipientId: "organizer",
              role: "ORGANIZER" as RecipientRole,
              kind: "PERCENTAGE" as const,
              percentageBps: parsed.organizerBps,
              priority: 3,
            });
          }
          const result = calculateDistribution({
            total,
            rules,
            rounding: "LARGEST_REMAINDER",
            eligibleRecipientIds: rules.map((r) => r.recipientId),
          });
          return jsonResult({
            ok: true,
            entries: result.entries.map((e) => ({
              recipientId: e.recipientId,
              amountMinor: e.amount.amountMinor.toString(),
            })),
          });
        },
      );
    },
  );

  server.registerTool(
    "mp_split_validate_order_payload",
    {
      title: "Validate MP order payload",
      description: "Valida payload Orders Split localmente (sin HTTP).",
      inputSchema: {
        totalMinor: z.string(),
        currency: z.enum(["ARS", "BRL", "USD"]),
        ownerUserId: z.string().min(1),
        partnerReceiverId: z.string().uuid(),
        deviceSessionId: z.string().min(1),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z
        .object({
          totalMinor: z.string(),
          currency: z.enum(["ARS", "BRL", "USD"]),
          ownerUserId: z.string(),
          partnerReceiverId: z.string().uuid(),
          deviceSessionId: z.string(),
        })
        .parse(input);

      return withAudit(
        {
          tool: "mp_split_validate_order_payload",
          action: "validate",
          dryRun: false,
          confirmed: false,
        },
        async () => {
          const total = money(parsed.currency, parsed.totalMinor);
          const half = total.amountMinor / 2n;
          const rest = total.amountMinor - half;
          const entries = [
            {
              receiverType: "owner" as const,
              receiverId: parsed.ownerUserId,
              amount: money(parsed.currency, half),
              consentStatus: "ACTIVE" as const,
            },
            {
              receiverType: "partner" as const,
              receiverId: parsed.partnerReceiverId,
              amount: money(parsed.currency, rest),
              consentStatus: "ACTIVE" as const,
            },
          ];
          validateSplitOrderForMercadoPago({
            total,
            amountType: "fixed",
            deviceSessionId: parsed.deviceSessionId,
            entries,
          });
          const built = buildMercadoPagoSplitOrderRequest({
            externalReference: "mcp-validate",
            total,
            amountType: "fixed",
            deviceSessionId: parsed.deviceSessionId,
            entries,
            payerEmail: "test@testuser.com",
          });
          return jsonResult({
            ok: true,
            payloadHash: built.payloadHash,
            splitCount: built.body.splits.length,
          });
        },
      );
    },
  );

  server.registerTool(
    "mp_split_list_consents",
    {
      title: "List MP split consents (sandbox)",
      description: "GET /v1/split-consent sandbox. Requiere token TEST y confirm.",
      inputSchema: {
        status: z.enum(["PENDING", "ACTIVE", "REJECTED", "CANCELED", "EXPIRED"]).optional(),
        dryRun: dryRunSchema,
        confirm: confirmSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z
        .object({
          status: z.enum(["PENDING", "ACTIVE", "REJECTED", "CANCELED", "EXPIRED"]).optional(),
          dryRun: dryRunSchema,
          confirm: confirmSchema,
        })
        .parse(input);
      const gate = resolveExecutionGate(parsed, "mp_split_list_consents");
      return withAudit(
        {
          tool: "mp_split_list_consents",
          action: "list",
          dryRun: gate.dryRun,
          confirmed: Boolean(parsed.confirm),
        },
        async () => {
          if (gate.dryRun) {
            return jsonResult({ dryRun: true, wouldCall: "GET /v1/split-consent" });
          }
          const { config, http } = requireSandboxHttp();
          const adapter = new MercadoPagoSplitConsentAdapter({ config, httpClient: http });
          const results = await adapter.list({
            environment: "sandbox",
            ...(parsed.status ? { status: parsed.status } : {}),
          });
          return jsonResult({
            count: results.length,
            results: results.map((r) => ({
              receiverIdPrefix: r.receiverId.slice(0, 8),
              status: r.status,
            })),
          });
        },
      );
    },
  );

  server.registerTool(
    "mp_split_get_consent",
    {
      title: "Get MP split consent (sandbox)",
      description: "Consulta consent por receiver_id (sanitizado).",
      inputSchema: {
        receiverId: z.string().uuid(),
        dryRun: dryRunSchema,
        confirm: confirmSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z
        .object({
          receiverId: z.string().uuid(),
          dryRun: dryRunSchema,
          confirm: confirmSchema,
        })
        .parse(input);
      const gate = resolveExecutionGate(parsed, "mp_split_get_consent");
      return withAudit(
        {
          tool: "mp_split_get_consent",
          action: "get",
          dryRun: gate.dryRun,
          confirmed: Boolean(parsed.confirm),
        },
        async () => {
          if (gate.dryRun) {
            return jsonResult({ dryRun: true, wouldCall: "GET /v1/split-consent" });
          }
          const { config, http } = requireSandboxHttp();
          const adapter = new MercadoPagoSplitConsentAdapter({ config, httpClient: http });
          const found = await adapter.getConsent(parsed.receiverId);
          return jsonResult({
            found: Boolean(found),
            status: found?.status,
            receiverIdPrefix: found?.receiverId.slice(0, 8),
          });
        },
      );
    },
  );

  server.registerTool(
    "mp_split_create_test_consent",
    {
      title: "Create TEST split consent",
      description: "POST /v1/split-consent sandbox only. Email *@testuser.com. confirm requerido.",
      inputSchema: {
        sellerEmail: z.string().email(),
        idempotencyKey: z.string().uuid(),
        forceStatus: z.enum(["ACTIVE", "PENDING", "REJECTED", "CANCELED", "EXPIRED"]).optional(),
        dryRun: dryRunSchema,
        confirm: confirmSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z
        .object({
          sellerEmail: z.string().email(),
          idempotencyKey: z.string().uuid(),
          forceStatus: z.enum(["ACTIVE", "PENDING", "REJECTED", "CANCELED", "EXPIRED"]).optional(),
          dryRun: dryRunSchema,
          confirm: confirmSchema,
        })
        .parse(input);
      if (!parsed.sellerEmail.endsWith("@testuser.com")) {
        throw new Error("Sandbox invites require *@testuser.com");
      }
      const gate = resolveExecutionGate(parsed, "mp_split_create_test_consent");
      return withAudit(
        {
          tool: "mp_split_create_test_consent",
          action: "invite",
          dryRun: gate.dryRun,
          confirmed: Boolean(parsed.confirm),
        },
        async () => {
          if (gate.dryRun) {
            return jsonResult({ dryRun: true, wouldCall: "POST /v1/split-consent" });
          }
          const { config, http } = requireSandboxHttp();
          const adapter = new MercadoPagoSplitConsentAdapter({ config, httpClient: http });
          const results = await adapter.invite({
            environment: "sandbox",
            sellerEmails: [parsed.sellerEmail],
            idempotencyKey: parsed.idempotencyKey,
            ...(parsed.forceStatus ? { forceStatus: parsed.forceStatus } : {}),
          });
          audit({
            tool: "mp_split_create_test_consent",
            action: "result",
            dryRun: false,
            confirmed: true,
            outcome: "success",
            metadata: { count: results.length, statuses: results.map((r) => r.status) },
          });
          return jsonResult({
            results: results.map((r) => ({
              status: r.status,
              receiverIdPrefix: r.receiverId.slice(0, 8),
              hasInviteUrl: Boolean(r.inviteUrl),
            })),
          });
        },
      );
    },
  );

  server.registerTool(
    "mp_split_cancel_test_consent",
    {
      title: "Cancel TEST split consent",
      description: "PATCH cancel consent sandbox. confirm requerido.",
      inputSchema: {
        receiverId: z.string().uuid(),
        dryRun: dryRunSchema,
        confirm: confirmSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => {
      const parsed = z
        .object({
          receiverId: z.string().uuid(),
          dryRun: dryRunSchema,
          confirm: confirmSchema,
        })
        .parse(input);
      const gate = resolveExecutionGate(parsed, "mp_split_cancel_test_consent");
      return withAudit(
        {
          tool: "mp_split_cancel_test_consent",
          action: "cancel",
          dryRun: gate.dryRun,
          confirmed: Boolean(parsed.confirm),
        },
        async () => {
          if (gate.dryRun) {
            return jsonResult({ dryRun: true, wouldCall: "PATCH /v1/split-consent/{id}" });
          }
          const { config, http } = requireSandboxHttp();
          const adapter = new MercadoPagoSplitConsentAdapter({ config, httpClient: http });
          const result = await adapter.cancel({
            environment: "sandbox",
            receiverId: parsed.receiverId,
          });
          return jsonResult({
            status: result.status,
            receiverIdPrefix: parsed.receiverId.slice(0, 8),
          });
        },
      );
    },
  );

  server.registerTool(
    "mp_split_get_test_order",
    {
      title: "Get TEST order",
      description: "GET /v1/orders/{id} sandbox (sanitizado).",
      inputSchema: {
        providerOrderId: z.string().min(1),
        ownerUserId: z.string().min(1),
        dryRun: dryRunSchema,
        confirm: confirmSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z
        .object({
          providerOrderId: z.string(),
          ownerUserId: z.string(),
          dryRun: dryRunSchema,
          confirm: confirmSchema,
        })
        .parse(input);
      const gate = resolveExecutionGate(parsed, "mp_split_get_test_order");
      return withAudit(
        {
          tool: "mp_split_get_test_order",
          action: "get_order",
          dryRun: gate.dryRun,
          confirmed: Boolean(parsed.confirm),
        },
        async () => {
          if (gate.dryRun) {
            return jsonResult({ dryRun: true, wouldCall: "GET /v1/orders/{id}" });
          }
          const { config, http } = requireSandboxHttp();
          const adapter = new MercadoPagoOrdersAdapter({
            config,
            ownerUserId: parsed.ownerUserId,
            httpClient: http,
          });
          const order = await adapter.getOrder(parsed.providerOrderId, "sandbox");
          return jsonResult({
            providerOrderIdPrefix: order.providerOrderId.slice(0, 12),
            status: order.status,
            statusDetail: order.statusDetail,
            paymentCount: order.payments.length,
          });
        },
      );
    },
  );

  server.registerTool(
    "mp_split_create_test_order",
    {
      title: "Create TEST split order",
      description:
        "POST /v1/orders sandbox only. confirm obligatorio. No production. No refunds.",
      inputSchema: {
        ownerUserId: z.string().min(1),
        partnerReceiverId: z.string().uuid(),
        totalMinor: z.string(),
        currency: z.enum(["ARS", "BRL"]),
        paymentToken: z.string().min(1),
        deviceSessionId: z.string().min(1),
        idempotencyKey: z.string().uuid(),
        dryRun: dryRunSchema,
        confirm: confirmSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z
        .object({
          ownerUserId: z.string(),
          partnerReceiverId: z.string().uuid(),
          totalMinor: z.string(),
          currency: z.enum(["ARS", "BRL"]),
          paymentToken: z.string(),
          deviceSessionId: z.string(),
          idempotencyKey: z.string().uuid(),
          dryRun: dryRunSchema,
          confirm: confirmSchema,
        })
        .parse(input);
      const gate = resolveExecutionGate(parsed, "mp_split_create_test_order");
      return withAudit(
        {
          tool: "mp_split_create_test_order",
          action: "create_order",
          dryRun: gate.dryRun,
          confirmed: Boolean(parsed.confirm),
        },
        async () => {
          if (gate.dryRun) {
            return jsonResult({ dryRun: true, wouldCall: "POST /v1/orders" });
          }
          const { config, http } = requireSandboxHttp();
          const total = money(parsed.currency, parsed.totalMinor);
          const half = total.amountMinor / 2n;
          const rest = total.amountMinor - half;
          const adapter = new MercadoPagoOrdersAdapter({
            config,
            ownerUserId: parsed.ownerUserId,
            httpClient: http,
            verifyAfterCreate: true,
          });
          const created = await adapter.createSplitOrder({
            environment: "sandbox",
            externalReference: `mcp-${parsed.idempotencyKey.slice(0, 8)}`,
            total,
            distribution: {
              total,
              entries: [
                {
                  recipientId: "platform",
                  role: "PLATFORM",
                  amount: money(parsed.currency, half),
                  ruleKind: "FIXED",
                  priority: 1,
                },
                {
                  recipientId: "photographer",
                  role: "PHOTOGRAPHER",
                  amount: money(parsed.currency, rest),
                  ruleKind: "FIXED",
                  priority: 2,
                },
              ],
              rounding: "LARGEST_REMAINDER",
              droppedRecipientIds: [],
            },
            idempotencyKey: parsed.idempotencyKey,
            deviceSessionId: parsed.deviceSessionId,
            payerEmail: "test@testuser.com",
            partnerReceiverIds: new Map([["photographer", parsed.partnerReceiverId]]),
            metadata: { paymentTokenPresent: "true" },
          });
          return jsonResult({
            providerOrderIdPrefix: created.providerOrderId.slice(0, 12),
            status: created.status,
          });
        },
      );
    },
  );
}
