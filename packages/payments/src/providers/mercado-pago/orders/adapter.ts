import type { PaymentEnvironment } from "../../../contracts/primitives.js";
import type {
  CreateProviderOrderInput,
  CreateProviderOrderResult,
  GetProviderOrderResult,
  PaymentProvider,
  ProviderRefundInput,
} from "../../types.js";
import { NotImplementedForSafetyError } from "../../../errors/provider-errors.js";
import { MercadoPagoHttpClient } from "../client/mercado-pago-http-client.js";
import type { MercadoPagoProviderConfig } from "../client/mercado-pago-environment.js";
import { MERCADOPAGO_ORDERS_CAPABILITIES } from "../capabilities.js";
import type { MpOrderCreateResponse, MpOrderResponse } from "./contracts.js";
import {
  buildMercadoPagoSplitOrderRequest,
  buildSplitEntriesFromDistribution,
  inferAmountType,
  mapMercadoPagoOrderResponse,
} from "./mapper.js";
import { validateSplitOrderForMercadoPago } from "./validator.js";
import { parseMercadoPagoOrdersWebhook } from "../webhooks/parser.js";
import { OrderAdapterError } from "./errors.js";
import {
  assertOrders1nStagingCreateAllowed,
  isOrders1nStagingFlagEnabled,
} from "./orders-1n-flag.js";

export interface MercadoPagoOrdersAdapterOptions {
  config: MercadoPagoProviderConfig;
  /** Server-side owner receiver_id — never from client input. */
  ownerUserId: string;
  httpClient?: MercadoPagoHttpClient;
  verifyAfterCreate?: boolean;
  /** Maps product recipientId -> MP receiver_id UUID for partners. */
  partnerReceiverIds?: Map<string, string>;
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

  constructor(opts: MercadoPagoOrdersAdapterOptions) {
    this.http = opts.httpClient ?? new MercadoPagoHttpClient(opts.config);
    this.config = opts.config;
    this.ownerUserId = opts.ownerUserId;
    this.verifyAfterCreate = opts.verifyAfterCreate ?? false;
    this.defaultPartnerReceiverIds = opts.partnerReceiverIds ?? new Map();
    this.enforceOrders1nStagingGate = opts.enforceOrders1nStagingGate ?? false;
    this.confirmStaging = opts.confirmStaging ?? false;
    this.confirmOrdersTest = opts.confirmOrdersTest ?? false;
  }

  capabilities() {
    return MERCADOPAGO_ORDERS_CAPABILITIES;
  }

  async createOrder(input: CreateProviderOrderInput): Promise<CreateProviderOrderResult> {
    throw new OrderAdapterError(
      "Use createSplitOrder with partnerReceiverIds — ownerUserId is server-side only",
    );
  }

  async createSplitOrder(input: CreateSplitOrderInput): Promise<CreateProviderOrderResult> {
    if (!input.deviceSessionId?.trim()) {
      throw new OrderAdapterError("deviceSessionId is required for Mercado Pago split orders");
    }

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
    const amountType = inferAmountType(input.distribution);
    const entries = buildSplitEntriesFromDistribution(
      input.distribution,
      this.ownerUserId,
      partnerReceiverIds,
    );

    validateSplitOrderForMercadoPago({
      total: input.total,
      amountType,
      entries,
      deviceSessionId: input.deviceSessionId,
    });

    const built = buildMercadoPagoSplitOrderRequest({
      externalReference: input.externalReference,
      total: input.total,
      amountType,
      entries,
      deviceSessionId: input.deviceSessionId,
      ...(input.payerEmail ? { payerEmail: input.payerEmail } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      ...(input.paymentToken ? { paymentToken: input.paymentToken } : {}),
      ...(input.paymentMethodId
        ? { paymentMethodId: input.paymentMethodId }
        : input.paymentToken
          ? { paymentMethodId: "visa" }
          : {}),
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

  async refund(_input: ProviderRefundInput): Promise<{ providerRefundId: string }> {
    throw new NotImplementedForSafetyError(
      "Mercado Pago split order refunds are not implemented for safety in sandbox adapter",
    );
  }

  async parseWebhook(
    headers: Record<string, string | undefined>,
    rawBody: string,
    environment: PaymentEnvironment,
  ) {
    return parseMercadoPagoOrdersWebhook(headers, rawBody, environment);
  }
}
