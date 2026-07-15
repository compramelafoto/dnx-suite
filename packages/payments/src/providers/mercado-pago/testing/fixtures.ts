import type { MercadoPagoProviderConfig } from "../client/mercado-pago-environment.js";
import { createMercadoPagoProviderConfig } from "../client/mercado-pago-environment.js";
import { money } from "../../../money/index.js";

/** Sanitized test fixtures — fake UUIDs, no real tokens. */
export const FAKE_OWNER_USER_ID = "2366102316";
export const FAKE_PARTNER_RECEIVER_ID = "b2c3d4e5-f6a7-4890-b123-456789abcdef";
export const FAKE_PARTNER_RECEIVER_ID_2 = "c3d4e5f6-a7b8-4901-a234-56789abcdef0";
export const FAKE_ORDER_ID = "ORDTST01FAKEORDER000000000001";
export const FAKE_CONSENT_RECEIVER_ID = "d4e5f6a7-b8c9-4012-a345-6789abcdef01";

export const SANDBOX_TEST_TOKEN = "TEST-fake-token-for-unit-tests-only";

export function fakeMercadoPagoConfig(): MercadoPagoProviderConfig {
  return createMercadoPagoProviderConfig({
    environment: "sandbox",
    accessToken: SANDBOX_TEST_TOKEN,
  });
}

export function fakeProductionConfig(): MercadoPagoProviderConfig {
  return createMercadoPagoProviderConfig({
    environment: "production",
    accessToken: "APP_USR-fake-production-token",
  });
}

export function fakeArsTotal(minor: number | bigint = 100_000n) {
  return money("ARS", minor);
}

export const fakeWebhookBody = JSON.stringify({
  id: 12345,
  live_mode: false,
  type: "Order",
  action: "Order.action_required",
  data: { id: FAKE_ORDER_ID },
});

export const fakeConsentCreateResponse = {
  succeeded: [
    {
      seller_email: "TESTUSER123@testuser.com",
      receiver_id: FAKE_CONSENT_RECEIVER_ID,
      status: "PENDING",
      invite_url: "https://www.mercadopago.com.ar/split/invite/fake",
    },
  ],
  failed: [],
};

export const fakeConsentListResponse = {
  paging: { total: 1, offset: 0, limit: 20 },
  results: [
    {
      receiver_id: FAKE_CONSENT_RECEIVER_ID,
      seller_email: "TESTUSER123@testuser.com",
      status: "ACTIVE",
    },
  ],
};

export const fakeOrderCreateResponse = {
  id: FAKE_ORDER_ID,
  status: "open",
  status_detail: "waiting_payment",
  external_reference: "ext-ref-001",
  total_amount: "1000.00",
  currency: "ARS",
  config: { split_rules: { amount_type: "fixed" } },
  splits: [
    { receiver_id: FAKE_OWNER_USER_ID, receiver_type: "owner", amount: "700.00" },
    { receiver_id: FAKE_PARTNER_RECEIVER_ID, receiver_type: "partner", amount: "300.00" },
  ],
  transactions: {
    payments: [{ id: "PAYFAKE001", status: "open", status_detail: "waiting_payment", amount: "1000.00" }],
  },
};

export const fakeOrderProcessedResponse = {
  id: FAKE_ORDER_ID,
  status: "processed",
  status_detail: "accredited",
  currency: "ARS",
  total_amount: "1000.00",
  transactions: {
    payments: [
      {
        id: "PAYFAKE001",
        status: "processed",
        status_detail: "accredited",
        amount: "1000.00",
        paid_amount: "1000.00",
      },
    ],
  },
};
