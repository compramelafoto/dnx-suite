/**
 * Clickatón → Mercado Pago Orders 1:N TEST bridge (10D3I-H).
 * Creates split order server-side; returns pending URL as "checkout"
 * because accreditation is automatic with payment token (no Preference redirect).
 */
import { calculateDistribution } from "../../../distribution/calculate.js";
import { money } from "../../../money/index.js";
import type { ClickatonCheckoutProviderBridge } from "./types.js";
import {
  assertOrders1nStagingCreateAllowed,
  isOrders1nStagingFlagEnabled,
} from "../../../providers/mercado-pago/orders/orders-1n-flag.js";
import { isClickatonDnxCheckoutEnabled } from "./checkout-dnx-flag.js";
import type { MercadoPagoOrdersAdapter } from "../../../providers/mercado-pago/orders/adapter.js";

export type Orders1nRegistrationBridgeDeps = {
  adapter: MercadoPagoOrdersAdapter;
  ownerUserId: string;
  partnerReceiverId: string;
  partnerReceiverId2: string;
  paymentToken: string;
  deviceSessionId: string;
  confirmStaging: boolean;
  confirmOrdersTest: boolean;
};

export function createMercadoPagoOrders1nClickatonBridge(
  deps: Orders1nRegistrationBridgeDeps,
): ClickatonCheckoutProviderBridge {
  return {
    mode: "mercado_pago_orders_test",
    providerName: "mercadopago",
    async createCheckout(input) {
      if (!isClickatonDnxCheckoutEnabled()) {
        throw new Error("CLICKATON_DNX_CHECKOUT_FLAG_OFF");
      }
      const gate = assertOrders1nStagingCreateAllowed({
        flagEnabled: isOrders1nStagingFlagEnabled(),
        environment: "sandbox",
        confirmStaging: deps.confirmStaging,
        confirmOrdersTest: deps.confirmOrdersTest,
        accessTokenPresent: true,
        accessTokenSandboxEligible: true,
        ownerUserIdPresent: Boolean(deps.ownerUserId.trim()),
        receiver1Present: Boolean(deps.partnerReceiverId.trim()),
        receiver2Present: Boolean(deps.partnerReceiverId2.trim()),
        paymentTokenPresent: Boolean(deps.paymentToken.trim()),
        deviceIdPresent: Boolean(deps.deviceSessionId.trim()),
      });
      if (!gate.ok) {
        throw new Error(`ORDERS_1N_GATE:${gate.reason}`);
      }

      const total = money(input.currency, BigInt(input.amountMinor));
      const distribution = calculateDistribution({
        total,
        rules: [
          {
            recipientId: "dani",
            role: "OTHER",
            kind: "PERCENTAGE",
            percentageBps: 3400,
            priority: 1,
            optional: false,
          },
          {
            recipientId: "rodri",
            role: "OTHER",
            kind: "PERCENTAGE",
            percentageBps: 3300,
            priority: 2,
            optional: false,
          },
          {
            recipientId: "tammy",
            role: "OTHER",
            kind: "PERCENTAGE",
            percentageBps: 3300,
            priority: 3,
            optional: false,
          },
        ],
        rounding: "LARGEST_REMAINDER",
        eligibleRecipientIds: ["dani", "rodri", "tammy"],
      });

      const partnerReceiverIds = new Map([
        ["rodri", deps.partnerReceiverId],
        ["tammy", deps.partnerReceiverId2],
      ]);

      const created = await deps.adapter.createSplitOrder({
        environment: "sandbox",
        externalReference: input.externalReference,
        total,
        distribution,
        idempotencyKey: input.idempotencyKey,
        deviceSessionId: deps.deviceSessionId,
        paymentToken: deps.paymentToken,
        paymentMethodId: "visa",
        payerEmail: input.payerEmail ?? "test_buyer@testuser.com",
        partnerReceiverIds,
        metadata: {
          sourceId: input.sourceId,
          stage: "10D3I-H",
          payloadHashPrefix: input.payloadHash.slice(0, 12),
        },
      });

      // Automatic processing: browser returns to pending until webhook/recon confirms.
      const checkoutUrl = input.pendingUrl;
      return {
        checkoutUrl,
        providerOrderId: created.providerOrderId,
        rawSanitized: {
          mode: "mercado_pago_orders_test",
          providerOrderIdPrefix: created.providerOrderId.slice(0, 10) + "…",
          status: created.status,
          externalReference: input.externalReference,
          liveMode: false,
        },
      };
    },
    async refreshCheckout(input) {
      const got = await deps.adapter.getOrder(input.providerOrderId, "sandbox");
      const approved =
        got.status === "PROCESSED_ACCREDITED" || got.status === "PROCESSED";
      return {
        status: approved ? "APPROVED" : got.status.startsWith("UNKNOWN") ? "PENDING" : "PROCESSING",
        amountMinor: input.expectedAmountMinor,
        currency: input.expectedCurrency,
        externalReference: input.externalReference,
        liveMode: false,
        rawSanitized: {
          providerOrderIdPrefix: got.providerOrderId.slice(0, 10) + "…",
          status: got.status,
          statusDetail: got.statusDetail ?? null,
        },
      };
    },
  };
}
