/**
 * Factory: Clickatón provider bridge (manual fake | Mercado Pago Checkout Pro TEST).
 */
import type { ClickatonCheckoutProviderBridge } from "../../../application/services/clickaton-checkout/types";
import {
  createMercadoPagoCheckoutProTestAdapter,
  type MercadoPagoCheckoutProTestAdapter,
} from "./preference-adapter";

export function createManualClickatonProviderBridge(): ClickatonCheckoutProviderBridge {
  // Deferred to createClickatonCheckoutService default — this export is for explicit wiring.
  return {
    mode: "manual",
    providerName: "manual",
    async createCheckout(input) {
      const base = (input.checkoutBaseUrl ?? "https://payments.test/checkout").replace(/\/$/, "");
      const checkoutUrl = `${base}/${input.orderId}`;
      return {
        checkoutUrl,
        providerOrderId: `fake_${input.orderId}`,
        rawSanitized: { checkoutUrl, mode: "manual" },
      };
    },
  };
}

function buildCheckoutProCollectorBridge(input: {
  adapter: MercadoPagoCheckoutProTestAdapter;
  mode: "mercado_pago_test" | "mercado_pago_production";
}): ClickatonCheckoutProviderBridge {
  const adapter = input.adapter;
  const mode = input.mode;
  return {
    mode,
    providerName: "mercadopago_preferences_legacy",
    async createCheckout(params) {
      if (!params.notificationUrl) {
        throw new Error(`notification_url_required_for_${mode}`);
      }
      if (!params.collectorAccessToken) {
        throw new Error(
          "edition_finance_collector_token_required: Checkout Pro debe usar OAuth del beneficiario (no token owner stub)",
        );
      }
      const created = await adapter.createPreference({
        amountMinor: params.amountMinor,
        currency: params.currency,
        description: params.description,
        externalReference: params.externalReference,
        idempotencyKey: params.idempotencyKey,
        payerEmail: params.payerEmail,
        successUrl: params.successUrl,
        pendingUrl: params.pendingUrl,
        failureUrl: params.failureUrl,
        notificationUrl: params.notificationUrl,
        accessTokenOverride: params.collectorAccessToken,
        metadata: {
          source_id: params.sourceId,
          payment_account_id: params.collectorPaymentAccountId ?? "",
          modality: params.editionFinanceModality ?? "CHECKOUT_PRO_COLLECTOR_OAUTH",
        },
      });
      return {
        checkoutUrl: created.checkoutUrl,
        providerOrderId: created.providerPreferenceId,
        rawSanitized: {
          ...created.rawSanitized,
          collectorPaymentAccountId: params.collectorPaymentAccountId ?? null,
          editionFinanceModality: params.editionFinanceModality ?? null,
          // Sin tokens.
        },
      };
    },
    async refreshCheckout(params) {
      // Preference id is stored as providerOrderId. Prefer payment id when numeric.
      // Otherwise resolve the associated payment via external_reference (Checkout Pro S2S).
      if (/^\d+$/.test(params.providerOrderId)) {
        const payment = await adapter.getPayment(params.providerOrderId);
        return {
          status: payment.status,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          externalReference: payment.externalReference,
          liveMode: payment.liveMode,
          providerFeeMinor: payment.providerFeeMinor ?? null,
          refundedAmountMinor: payment.refundedAmountMinor,
          netAmountMinor: payment.netAmountMinor,
          providerRefundIds: payment.providerRefundIds,
          statusDetail: payment.statusDetail,
          rawSanitized: payment.rawSanitized,
        };
      }
      const byRef = await adapter.searchPaymentsByExternalReference(params.externalReference);
      if (byRef) {
        return {
          status: byRef.status,
          amountMinor: byRef.amountMinor,
          currency: byRef.currency,
          externalReference: byRef.externalReference,
          liveMode: byRef.liveMode,
          providerFeeMinor: byRef.providerFeeMinor ?? null,
          refundedAmountMinor: byRef.refundedAmountMinor,
          netAmountMinor: byRef.netAmountMinor,
          providerRefundIds: byRef.providerRefundIds,
          statusDetail: byRef.statusDetail,
          rawSanitized: {
            ...byRef.rawSanitized,
            refresh_note: "payment_resolved_by_external_reference",
            providerPaymentId: byRef.providerPaymentId,
          },
        };
      }
      const pref = await adapter.getPreference(params.providerOrderId);
      return {
        status: "PENDING",
        amountMinor: params.expectedAmountMinor,
        currency: params.expectedCurrency,
        externalReference: pref.externalReference ?? params.externalReference,
        liveMode: false,
        rawSanitized: {
          ...pref.rawSanitized,
          refresh_note: "preference_pending_no_payment_yet",
        },
      };
    },
    async fetchPaymentById(paymentId) {
      if (!/^\d+$/.test(paymentId)) return null;
      const payment = await adapter.getPayment(paymentId);
      return {
        status: payment.status,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        externalReference: payment.externalReference,
        liveMode: payment.liveMode,
        providerPaymentId: payment.providerPaymentId,
        providerFeeMinor: payment.providerFeeMinor ?? null,
        refundedAmountMinor: payment.refundedAmountMinor,
        netAmountMinor: payment.netAmountMinor,
        providerRefundIds: payment.providerRefundIds,
        statusDetail: payment.statusDetail,
        rawSanitized: payment.rawSanitized,
      };
    },
  };
}

export function createMercadoPagoTestClickatonProviderBridge(input: {
  adapter: MercadoPagoCheckoutProTestAdapter;
}): ClickatonCheckoutProviderBridge {
  return buildCheckoutProCollectorBridge({
    adapter: input.adapter,
    mode: "mercado_pago_test",
  });
}

/** Checkout Pro LIVE (N=1 collector OAuth). Only wire when LIVE flag + Production runtime. */
export function createMercadoPagoProductionClickatonProviderBridge(input: {
  adapter: MercadoPagoCheckoutProTestAdapter;
}): ClickatonCheckoutProviderBridge {
  return buildCheckoutProCollectorBridge({
    adapter: input.adapter,
    mode: "mercado_pago_production",
  });
}

export {
  resolveClickatonPaymentsProviderModeControlled as resolveClickatonPaymentsProviderMode,
  type ClickatonPaymentsProviderMode,
  type ResolveProviderModeOptions,
} from "../../../application/services/clickaton-checkout/live-payments-flag";

export { createMercadoPagoCheckoutProTestAdapter };
