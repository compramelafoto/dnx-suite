/**
 * Clickatón → Mercado Pago Orders 1:N **productivo** para el reparto al
 * fotógrafo afiliado (dueño del cupón).
 *
 * - Dueño: la cuenta cobradora DNX (`ownerUserId`, server-side). Se lleva el resto.
 * - Partner: el afiliado, con monto fijo y permiso de Split ACTIVO real
 *   (nunca fixture de prueba).
 * - Token de tarjeta y device session vienen del Card Payment Brick.
 * - El token OAuth de escritura es el del collector de la edición (snapshot
 *   financiero); el de lectura (refresh) se resuelve en el momento.
 *
 * A diferencia del puente sandbox (`orders-1n-registration-bridge.ts`), no
 * reparte porcentajes fijos de prueba ni exige los flags de staging.
 */
import { createHash } from "node:crypto";
import { calculateDistribution } from "../../../distribution/calculate.js";
import { money } from "../../../money/index.js";
import { MercadoPagoOrdersAdapter } from "../../../providers/mercado-pago/orders/adapter.js";
import { MercadoPagoHttpClient } from "../../../providers/mercado-pago/client/mercado-pago-http-client.js";
import { createMercadoPagoProviderConfig } from "../../../providers/mercado-pago/client/mercado-pago-environment.js";
import type { PartnerConsentEvidence } from "../../../providers/mercado-pago/orders/consent-evidence.js";
import type { OrderPayerProfile } from "../../../providers/mercado-pago/orders/payer-profile.js";
import { singleIntangibleItem } from "../../../providers/mercado-pago/orders/order-items.js";
import { mapProviderOrderStatusToCardUiState } from "../../../frontend/status-detail-messages.js";
import type {
  ClickatonCheckoutProviderBridge,
  NormalizedCheckoutStatus,
} from "./types.js";

/** Lo único que este puente usa del adapter de Orders (para poder probarlo). */
export type AffiliateSplitOrdersAdapterPort = Pick<
  MercadoPagoOrdersAdapter,
  "createSplitOrder" | "getOrder"
>;

export type OrdersAffiliateSplitBridgeDeps = {
  /**
   * Arma el adapter productivo con el token dado (environment production,
   * allowProductionWrites, allowTestFixtures:false, sin gate de staging).
   */
  createAdapter(accessToken: string): AffiliateSplitOrdersAdapterPort;
  /** Usuario de MP de la cuenta cobradora (dueño del reparto). */
  ownerUserId: string;
  /** Token para leer órdenes (refresh) de la cuenta dueña. Se resuelve en cada llamada. */
  resolveReadAccessToken(): string | undefined | Promise<string | undefined>;
  /**
   * Si se indica, el payment account collector de la edición tiene que ser
   * éste: el token de escritura debe pertenecer a `ownerUserId`.
   */
  expectedCollectorPaymentAccountId?: string;
  statementDescriptor?: string;
};

/**
 * Adapter de Orders **productivo** para el reparto al afiliado:
 * environment production + allowProductionWrites, sin fixtures de prueba y sin
 * el gate de staging (este camino tiene su propio interruptor en la app).
 */
export function createProductionAffiliateSplitOrdersAdapter(input: {
  accessToken: string;
  ownerUserId: string;
  statementDescriptor?: string;
  /** Sólo tests: reemplaza `fetch`. */
  fetchImpl?: ConstructorParameters<typeof MercadoPagoHttpClient>[1];
}): MercadoPagoOrdersAdapter {
  const config = createMercadoPagoProviderConfig({
    environment: "production",
    accessToken: input.accessToken,
    allowProductionWrites: true,
  });
  const httpClient = input.fetchImpl
    ? new MercadoPagoHttpClient(config, input.fetchImpl)
    : new MercadoPagoHttpClient(config);
  return new MercadoPagoOrdersAdapter({
    config,
    ownerUserId: input.ownerUserId,
    httpClient,
    verifyAfterCreate: false,
    allowTestFixtures: false,
    enforceOrders1nStagingGate: false,
    defaultStatementDescriptor: input.statementDescriptor ?? "CLICKATON",
  });
}

const OWNER_RECIPIENT_ID = "clickaton-collector-owner";
export const AFFILIATE_SPLIT_BRIDGE_STAGE = "CLICKATON-AFFILIATE-SPLIT";

function toNormalizedImmediate(providerStatus: string): NormalizedCheckoutStatus {
  const ui = mapProviderOrderStatusToCardUiState(providerStatus);
  if (ui === "APPROVED") return "APPROVED";
  if (ui === "REJECTED") return "REJECTED";
  if (ui === "PROCESSING") return "PROCESSING";
  return "PENDING";
}

/** Estado de `getOrder` (mapper de Orders) → estado normalizado DNX. */
export function mapAffiliateSplitOrderStatus(status: string): NormalizedCheckoutStatus {
  const s = status.toUpperCase();
  if (s === "PROCESSED_ACCREDITED" || s === "PROCESSED") return "APPROVED";
  if (s === "REFUNDED") return "REFUNDED";
  if (s === "CHARGED_BACK") return "CHARGEBACK";
  if (s === "FAILED") return "REJECTED";
  if (s === "CANCELED" || s === "CANCELLED") return "CANCELLED";
  if (s === "OPEN") return "PROCESSING";
  return "PENDING";
}

/**
 * Clave de idempotencia para Mercado Pago: UUID determinístico derivado de la
 * clave DNX (la de DNX es larga y lleva ':'). Misma clave DNX ⇒ misma clave MP.
 */
export function deriveMercadoPagoIdempotencyKey(dnxKey: string): string {
  const h = createHash("sha256").update(`clickaton-affiliate-split:${dnxKey}`).digest("hex");
  // Formato UUID v4-like (versión 4, variante 8).
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    `8${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join("-");
}

function clean(value: string | undefined | null): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

export function createMercadoPagoOrdersAffiliateSplitBridge(
  deps: OrdersAffiliateSplitBridgeDeps,
): ClickatonCheckoutProviderBridge {
  return {
    mode: "mercado_pago_production",
    providerName: "mercadopago",
    async createCheckout(input) {
      const split = input.affiliateSplit;
      if (!split) {
        throw new Error("AFFILIATE_SPLIT_REQUIRED: falta el reparto al afiliado");
      }
      const card = input.cardPayment;
      if (!card) {
        throw new Error("CARD_PAYMENT_REQUIRED: el reparto sólo va con pago con tarjeta");
      }
      const paymentToken = clean(card.token);
      const deviceSessionId = clean(card.deviceSessionId);
      const paymentMethodId = clean(card.paymentMethodId);
      const payerEmail = clean(card.payer.email) ?? clean(input.payerEmail);
      if (!paymentToken) throw new Error("CARD_TOKEN_REQUIRED");
      if (!deviceSessionId) throw new Error("DEVICE_SESSION_REQUIRED");
      if (!paymentMethodId) throw new Error("PAYMENT_METHOD_REQUIRED");
      if (!payerEmail) throw new Error("PAYER_EMAIL_REQUIRED");

      const ownerUserId = deps.ownerUserId.trim();
      if (!ownerUserId) throw new Error("OWNER_REQUIRED");

      const collectorToken = clean(input.collectorAccessToken);
      if (!collectorToken) {
        throw new Error(
          "edition_finance_collector_token_required: el reparto usa el OAuth del collector",
        );
      }
      if (
        deps.expectedCollectorPaymentAccountId &&
        input.collectorPaymentAccountId !== deps.expectedCollectorPaymentAccountId
      ) {
        throw new Error(
          "AFFILIATE_SPLIT_COLLECTOR_MISMATCH: el collector de la edición no es la cuenta dueña del reparto",
        );
      }

      const totalMinor = input.amountMinor;
      const partnerMinor = split.partnerAmountMinor;
      if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) {
        throw new Error("AFFILIATE_SPLIT_INVALID_TOTAL");
      }
      if (
        !Number.isSafeInteger(partnerMinor) ||
        partnerMinor <= 0 ||
        partnerMinor >= totalMinor
      ) {
        throw new Error("AFFILIATE_SPLIT_INVALID_AMOUNT: 0 < monto del afiliado < total");
      }
      const recipientId = split.recipientId.trim();
      const receiverId = split.receiverId.trim();
      if (!recipientId || recipientId === OWNER_RECIPIENT_ID || !receiverId) {
        throw new Error("AFFILIATE_SPLIT_INVALID_RECEIVER");
      }

      const total = money(input.currency, BigInt(totalMinor));
      // El afiliado: monto fijo. El dueño: 100% de lo que queda.
      const distribution = calculateDistribution({
        total,
        rules: [
          {
            recipientId,
            role: "AFFILIATE",
            kind: "FIXED",
            fixedAmount: money(input.currency, BigInt(partnerMinor)),
            priority: 1,
            optional: false,
          },
          {
            recipientId: OWNER_RECIPIENT_ID,
            role: "PLATFORM",
            kind: "PERCENTAGE",
            percentageBps: 10_000,
            priority: 2,
            optional: false,
          },
        ],
        rounding: "LARGEST_REMAINDER",
        eligibleRecipientIds: [recipientId, OWNER_RECIPIENT_ID],
      });
      const partnerEntry = distribution.entries.find((e) => e.recipientId === recipientId);
      const ownerEntry = distribution.entries.find(
        (e) => e.recipientId === OWNER_RECIPIENT_ID,
      );
      if (
        partnerEntry?.amount.amountMinor !== BigInt(partnerMinor) ||
        ownerEntry?.amount.amountMinor !== BigInt(totalMinor - partnerMinor)
      ) {
        throw new Error("AFFILIATE_SPLIT_DISTRIBUTION_MISMATCH");
      }

      // Evidencia real: viene de `DnxSplitConsent` ACTIVO (lo resolvió el checkout).
      const consent: PartnerConsentEvidence = {
        receiverId,
        status: "ACTIVE",
        provider: "mercadopago",
      };

      const identification =
        clean(card.payer.identification?.type) && clean(card.payer.identification?.number)
          ? {
              type: card.payer.identification!.type.trim(),
              number: card.payer.identification!.number.trim(),
            }
          : undefined;
      const firstName = clean(input.payerName?.firstName);
      const lastName = clean(input.payerName?.lastName);
      const payerProfile: OrderPayerProfile | undefined =
        identification || firstName || lastName
          ? {
              ...(firstName ? { firstName } : {}),
              ...(lastName ? { lastName } : {}),
              ...(identification ? { identification } : {}),
            }
          : undefined;

      const adapter = deps.createAdapter(collectorToken);
      const created = await adapter.createSplitOrder({
        environment: "production",
        externalReference: input.externalReference,
        total,
        distribution,
        idempotencyKey: deriveMercadoPagoIdempotencyKey(input.idempotencyKey),
        deviceSessionId,
        paymentToken,
        paymentMethodId,
        installments:
          Number.isSafeInteger(card.installments) && card.installments > 0
            ? card.installments
            : 1,
        payerEmail,
        ...(payerProfile ? { payerProfile } : {}),
        statementDescriptor: deps.statementDescriptor ?? "CLICKATON",
        items: [
          singleIntangibleItem({
            title: "Inscripcion Clickaton",
            total,
            categoryId: "others",
            id: input.sourceId,
          }),
        ],
        partnerReceiverIds: new Map([[recipientId, receiverId]]),
        partnerConsentsByRecipientId: new Map([[recipientId, consent]]),
        metadata: {
          sourceId: input.sourceId,
          stage: AFFILIATE_SPLIT_BRIDGE_STAGE,
          payloadHashPrefix: input.payloadHash.slice(0, 12),
        },
      });

      const immediateStatus = toNormalizedImmediate(created.status);
      const checkoutUrl =
        immediateStatus === "APPROVED"
          ? input.successUrl
          : immediateStatus === "REJECTED"
            ? input.failureUrl
            : input.pendingUrl;
      const rawDetail =
        typeof created.raw === "object" &&
        created.raw &&
        "status_detail" in created.raw &&
        typeof (created.raw as { status_detail?: unknown }).status_detail === "string"
          ? (created.raw as { status_detail: string }).status_detail
          : created.status;

      return {
        checkoutUrl,
        providerOrderId: created.providerOrderId,
        immediateStatus,
        statusDetail: rawDetail,
        rawSanitized: {
          mode: "mercado_pago_production",
          modality: "ORDERS_1N_AFFILIATE_SPLIT",
          providerOrderIdPrefix: created.providerOrderId.slice(0, 10) + "…",
          status: created.status,
          immediateStatus,
          externalReference: input.externalReference,
          liveMode: true,
          affiliateRecipientId: recipientId,
          affiliateReceiverIdPrefix: receiverId.slice(0, 8) + "…",
          affiliateAmountMinor: partnerMinor,
          ownerAmountMinor: totalMinor - partnerMinor,
          collectorPaymentAccountId: input.collectorPaymentAccountId ?? null,
        },
      };
    },
    async refreshCheckout(input) {
      const token = clean(await deps.resolveReadAccessToken());
      if (!token) {
        throw new Error("AFFILIATE_SPLIT_READ_TOKEN_MISSING");
      }
      const got = await deps.createAdapter(token).getOrder(input.providerOrderId, "production");
      return {
        status: mapAffiliateSplitOrderStatus(got.status),
        // El monto lo fijó el servidor al crear la orden; no se reinterpreta acá.
        amountMinor: input.expectedAmountMinor,
        currency: input.expectedCurrency,
        externalReference: input.externalReference,
        liveMode: true,
        rawSanitized: {
          providerOrderIdPrefix: got.providerOrderId.slice(0, 10) + "…",
          status: got.status,
          statusDetail: got.statusDetail ?? null,
          modality: "ORDERS_1N_AFFILIATE_SPLIT",
        },
      };
    },
  };
}
