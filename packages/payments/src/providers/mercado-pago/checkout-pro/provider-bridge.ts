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

export function createMercadoPagoTestClickatonProviderBridge(input: {
  adapter: MercadoPagoCheckoutProTestAdapter;
}): ClickatonCheckoutProviderBridge {
  const adapter = input.adapter;
  return {
    mode: "mercado_pago_test",
    providerName: "mercadopago_preferences_legacy",
    async createCheckout(params) {
      if (!params.notificationUrl) {
        throw new Error("notification_url_required_for_mercado_pago_test");
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
        return payment;
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
        rawSanitized: payment.rawSanitized,
      };
    },
  };
}

export function resolveClickatonPaymentsProviderMode(
  raw: string | undefined,
): "manual" | "mercado_pago_test" | "mercado_pago_orders_test" {
  const v = (raw ?? "manual").trim().toLowerCase();
  if (v === "mercado_pago_test" || v === "mercadopago_test" || v === "mp_test") {
    return "mercado_pago_test";
  }
  if (
    v === "mercado_pago_orders_test" ||
    v === "mercadopago_orders_test" ||
    v === "mp_orders_test" ||
    v === "orders_1n_test"
  ) {
    return "mercado_pago_orders_test";
  }
  if (v === "manual" || v === "" || v === "fake") return "manual";
  if (v === "mercado_pago_production" || v === "production") {
    throw new Error("mercado_pago_production_forbidden");
  }
  throw new Error(`unknown_clickaton_payments_provider:${v}`);
}

export { createMercadoPagoCheckoutProTestAdapter };
