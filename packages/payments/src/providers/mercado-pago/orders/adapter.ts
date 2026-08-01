import type { PaymentEnvironment } from "../../../contracts/primitives.js";
import type {
  CreateProviderOrderInput,
  CreateProviderOrderResult,
  GetProviderOrderResult,
  PaymentProvider,
  ProviderRefundInput,
  ProviderRefundResult,
} from "../../types.js";
import { MercadoPagoHttpClient } from "../client/mercado-pago-http-client.js";
import { createMercadoPagoOrderRefund } from "../refunds/client.js";
import type { MercadoPagoProviderConfig } from "../client/mercado-pago-environment.js";
import { MERCADOPAGO_ORDERS_CAPABILITIES } from "../capabilities.js";
import type { MpOrderCreateResponse, MpOrderResponse } from "./contracts.js";
import {
  buildMercadoPagoSplitOrderRequest,
  buildSplitEntriesFromDistribution,
  resolveMpAmountType,
  mapMercadoPagoOrderResponse,
} from "./mapper.js";
import { validateMercadoPagoSplitOrder } from "./validator.js";
import { parseMercadoPagoOrdersWebhook } from "../webhooks/parser.js";
import { OrderAdapterError } from "./errors.js";
import {
  assertOrders1nStagingCreateAllowed,
  isOrders1nStagingFlagEnabled,
} from "./orders-1n-flag.js";
import type { PartnerConsentEvidence } from "./consent-evidence.js";
import type { OrderItemInput, ItemsTotalRelation } from "./order-items.js";
import {
  DEFAULT_MP_SPLIT_AMOUNT_TYPE_STRATEGY,
  type MpSplitAmountTypeStrategy,
} from "./constants.js";

export interface MercadoPagoOrdersAdapterOptions {
  config: MercadoPagoProviderConfig;
  /** Server-side owner receiver_id — never from client input. */
  ownerUserId: string;
  httpClient?: MercadoPagoHttpClient;
  verifyAfterCreate?: boolean;
  /** Maps product recipientId -> MP receiver_id UUID for partners. */
  partnerReceiverIds?: Map<string, string>;
  /**
   * Consumer/product statement descriptor fallback (e.g. "DNX", "CLICKATON").
   * Not hardcoded to a single app inside the package default.
   */
  defaultStatementDescriptor?: string;
  /**
   * When true, allow testFixture consents and known device placeholders.
   * Unit tests / controlled sandbox CLI only — never production.
   */
  allowTestFixtures?: boolean;
  mpSplitAmountTypeStrategy?: MpSplitAmountTypeStrategy;
  /**
   * When true (default for staging CLI), require DNX_MP_ORDERS_1N_STAGING_ENABLED
   * + confirm flags before live createSplitOrder HTTP.
   * Unit tests can set false.
   */
  enforceOrders1nStagingGate?: boolean;
  confirmStaging?: boolean;
  confirmOrdersTest?: boolean;
}

export interface CreateSplitOrderInput extends CreateProviderOrderInput {
  partnerReceiverIds: Map<string, string>;
  /** Required evidence keyed by product recipientId — never invent ACTIVE. */
  partnerConsentsByRecipientId: Map<string, PartnerConsentEvidence>;
  /** Required payer email (real buyer). */
  payerEmail: string;
  /** Card extract descriptor; falls back to adapter defaultStatementDescriptor. */
  statementDescriptor?: string;
  items: OrderItemInput[];
  itemsTotalRelation?: ItemsTotalRelation;
  mpSplitAmountTypeStrategy?: MpSplitAmountTypeStrategy;
  /** Explicit device/session from payer frontend context (Brick later). */
  deviceSessionId: string;
}

export class MercadoPagoOrdersAdapter implements PaymentProvider {
  readonly name = "mercadopago" as const;
  private readonly http: MercadoPagoHttpClient;
  private readonly ownerUserId: string;
  private readonly verifyAfterCreate: boolean;
  private readonly defaultPartnerReceiverIds: Map<string, string>;
  private readonly enforceOrders1nStagingGate: boolean;
  private readonly confirmStaging: boolean;
  private readonly confirmOrdersTest: boolean;
  private readonly config: MercadoPagoProviderConfig;
  private readonly defaultStatementDescriptor?: string;
  private readonly allowTestFixtures: boolean;
  private readonly mpSplitAmountTypeStrategy: MpSplitAmountTypeStrategy;

  constructor(opts: MercadoPagoOrdersAdapterOptions) {
    this.http = opts.httpClient ?? new MercadoPagoHttpClient(opts.config);
    this.config = opts.config;
    this.ownerUserId = opts.ownerUserId;
    this.verifyAfterCreate = opts.verifyAfterCreate ?? false;
    this.defaultPartnerReceiverIds = opts.partnerReceiverIds ?? new Map();
    this.enforceOrders1nStagingGate = opts.enforceOrders1nStagingGate ?? false;
    this.confirmStaging = opts.confirmStaging ?? false;
    this.confirmOrdersTest = opts.confirmOrdersTest ?? false;
    this.defaultStatementDescriptor = opts.defaultStatementDescriptor;
    this.allowTestFixtures = opts.allowTestFixtures ?? false;
    this.mpSplitAmountTypeStrategy =
      opts.mpSplitAmountTypeStrategy ?? DEFAULT_MP_SPLIT_AMOUNT_TYPE_STRATEGY;
  }

  capabilities() {
    return MERCADOPAGO_ORDERS_CAPABILITIES;
  }

  async createOrder(input: CreateProviderOrderInput): Promise<CreateProviderOrderResult> {
    void input;
    throw new OrderAdapterError(
      "Use createSplitOrder with partnerReceiverIds — ownerUserId is server-side only",
    );
  }

  async createSplitOrder(input: CreateSplitOrderInput): Promise<CreateProviderOrderResult> {
    if (this.enforceOrders1nStagingGate) {
      const gate = assertOrders1nStagingCreateAllowed({
        flagEnabled: isOrders1nStagingFlagEnabled(),
        environment: this.config.environment === "sandbox" ? "sandbox" : "production",
        confirmStaging: this.confirmStaging,
        confirmOrdersTest: this.confirmOrdersTest,
        accessTokenPresent: Boolean(this.config.accessToken?.trim()),
        accessTokenSandboxEligible: this.config.environment === "sandbox",
        ownerUserIdPresent: Boolean(this.ownerUserId.trim()),
        receiver1Present: input.partnerReceiverIds.size >= 1,
        receiver2Present: input.partnerReceiverIds.size >= 2,
        paymentTokenPresent: Boolean(input.paymentToken?.trim()),
        deviceIdPresent: Boolean(input.deviceSessionId?.trim()),
      });
      if (!gate.ok) {
        throw new OrderAdapterError(`ORDERS_1N_GATE:${gate.reason}`);
      }
    }

    const partnerReceiverIds = input.partnerReceiverIds;
    const strategy =
      input.mpSplitAmountTypeStrategy ?? this.mpSplitAmountTypeStrategy;
    const amountType = resolveMpAmountType(input.distribution, strategy);
    const entries = buildSplitEntriesFromDistribution(
      input.distribution,
      this.ownerUserId,
      partnerReceiverIds,
      {
        partnerConsentsByRecipientId: input.partnerConsentsByRecipientId,
        amountType,
      },
    );

    const validated = validateMercadoPagoSplitOrder({
      externalReference: input.externalReference,
      total: input.total,
      amountType,
      entries,
      deviceSessionId: input.deviceSessionId,
      payerEmail: input.payerEmail,
      statementDescriptor: input.statementDescriptor,
      defaultStatementDescriptor: this.defaultStatementDescriptor,
      items: input.items,
      itemsTotalRelation: input.itemsTotalRelation ?? "informative",
      partnerReceiverIds,
      partnerConsentsByRecipientId: input.partnerConsentsByRecipientId,
      ownerUserId: this.ownerUserId,
      allowTestFixtures: this.allowTestFixtures,
    });

    const built = buildMercadoPagoSplitOrderRequest({
      externalReference: validated.externalReference,
      total: input.total,
      amountType,
      entries,
      deviceSessionId: validated.deviceSessionId,
      payerEmail: validated.payerEmail,
      statementDescriptor: validated.statementDescriptor,
      items: input.items,
      ...(input.metadata ? { metadata: input.metadata } : {}),
      ...(input.paymentToken ? { paymentToken: input.paymentToken } : {}),
      ...(input.paymentMethodId
        ? { paymentMethodId: input.paymentMethodId }
        : input.paymentToken
          ? { paymentMethodId: "visa" }
          : {}),
      ...(input.installments != null ? { installments: input.installments } : {}),
    });

    const response = await this.http.request<MpOrderCreateResponse>({
      method: "POST",
      path: "/v1/orders",
      body: built.body,
      headers: built.headers,
      idempotencyKey: input.idempotencyKey,
      correlationId: built.payloadHash.slice(0, 32),
    });

    if (!response.body?.id) {
      throw new OrderAdapterError("Invalid order create response from Mercado Pago");
    }

    if (this.verifyAfterCreate) {
      await this.getOrder(response.body.id, input.environment);
    }

    const mapped = mapMercadoPagoOrderResponse(response.body);

    return {
      providerOrderId: mapped.providerOrderId,
      status: mapped.status,
      raw: response.body,
    };
  }

  async getOrder(
    providerOrderId: string,
    environment: PaymentEnvironment,
  ): Promise<GetProviderOrderResult> {
    void environment;

    const response = await this.http.request<MpOrderResponse>({
      method: "GET",
      path: `/v1/orders/${providerOrderId}`,
    });

    if (!response.body?.id) {
      throw new OrderAdapterError(`Order not found: ${providerOrderId}`);
    }

    const mapped = mapMercadoPagoOrderResponse(response.body);

    return {
      providerOrderId: mapped.providerOrderId,
      status: mapped.status,
      payments: mapped.payments,
      ...(mapped.statusDetail ? { statusDetail: mapped.statusDetail } : {}),
    };
  }

  /**
   * Orders API: POST /v1/orders/{order_id}/refund
   * Total = empty body; partial = transactions[{id,amount}].
   * Sandbox write guards enforced by HTTP client.
   */
  async refund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
    const result = await createMercadoPagoOrderRefund(this.http, {
      providerOrderId: input.providerOrderId,
      idempotencyKey: input.idempotencyKey,
      ...(input.amount ? { amount: input.amount } : {}),
      ...(input.providerTransactionId
        ? { providerTransactionId: input.providerTransactionId }
        : {}),
    });
    return {
      providerRefundId: result.providerRefundIds[0] ?? result.providerOrderId,
      providerRefundIds: result.providerRefundIds,
      orderStatus: result.orderStatus,
      ...(result.statusDetail ? { statusDetail: result.statusDetail } : {}),
      rawSanitized: result.rawSanitized,
    };
  }

  async parseWebhook(
    headers: Record<string, string | undefined>,
    rawBody: string,
    environment: PaymentEnvironment,
  ) {
    return parseMercadoPagoOrdersWebhook(headers, rawBody, environment);
  }
}
