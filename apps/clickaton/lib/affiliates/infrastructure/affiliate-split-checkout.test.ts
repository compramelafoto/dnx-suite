import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveProductionCardBrickPublicKey,
  resolveRegistrationPaymentMethod,
  type AffiliateSplitCheckoutPort,
} from "./affiliate-split-checkout";
import { isAffiliateSplitActive } from "./affiliate-split-flag";

function port(overrides: Partial<{ status: string; receiver: boolean }> = {}) {
  const calls: string[] = [];
  const p: AffiliateSplitCheckoutPort = {
    async loadCommission() {
      calls.push("commission");
      return {
        affiliateId: "aff_1",
        status: overrides.status ?? "PENDING",
        mode: null,
        baseAmount: 30_000_00,
        commissionBps: 1000,
        mpFeeBps: 600,
        netAmount: 2_820_00,
      };
    },
    async getActiveReceiver() {
      calls.push("receiver");
      return overrides.receiver === false
        ? null
        : { receiverId: "3f8a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b", recipientId: "rcp_1" };
    },
    async markSplit() {
      return true;
    },
  };
  return { p, calls };
}

test("apagado: lo de siempre, sin tocar la base", async () => {
  const { p, calls } = port();
  const method = await resolveRegistrationPaymentMethod("reg_1", {
    port: p,
    isActive: () => false,
    loadTotalAmount: async () => 27_000_00,
  });
  assert.equal(method, "default");
  assert.deepEqual(calls, []);
});

test("encendido: tarjeta con reparto sólo si todo califica", async () => {
  const total = async () => 27_000_00;
  assert.equal(
    await resolveRegistrationPaymentMethod("reg_1", { port: port().p, isActive: () => true, loadTotalAmount: total }),
    "card_brick_split",
  );
  assert.equal(
    await resolveRegistrationPaymentMethod("reg_1", {
      port: port({ receiver: false }).p,
      isActive: () => true,
      loadTotalAmount: total,
    }),
    "default",
  );
  assert.equal(
    await resolveRegistrationPaymentMethod("reg_1", {
      port: port({ status: "REVERSED" }).p,
      isActive: () => true,
      loadTotalAmount: total,
    }),
    "default",
  );
  // Código del 100%: nada que repartir.
  assert.equal(
    await resolveRegistrationPaymentMethod("reg_1", {
      port: port().p,
      isActive: () => true,
      loadTotalAmount: async () => 0,
    }),
    "default",
  );
});

test("el reparto sólo se activa en producción y con el interruptor", () => {
  assert.equal(isAffiliateSplitActive({} as NodeJS.ProcessEnv), false);
  assert.equal(
    isAffiliateSplitActive({
      DNX_CLICKATON_AFFILIATE_SPLIT_ENABLED: "true",
      CLICKATON_DNX_PAYMENTS_PROVIDER: "mercado_pago_test",
    } as unknown as NodeJS.ProcessEnv),
    false,
  );
  // Producción pedida fuera del runtime de producción: falla cerrado.
  assert.equal(
    isAffiliateSplitActive({
      DNX_CLICKATON_AFFILIATE_SPLIT_ENABLED: "true",
      CLICKATON_DNX_PAYMENTS_PROVIDER: "mercado_pago_production",
    } as unknown as NodeJS.ProcessEnv),
    false,
  );
  assert.equal(
    isAffiliateSplitActive({
      DNX_CLICKATON_AFFILIATE_SPLIT_ENABLED: "true",
      CLICKATON_DNX_PAYMENTS_PROVIDER: "mercado_pago_production",
      VERCEL_ENV: "production",
      DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED: "true",
    } as unknown as NodeJS.ProcessEnv),
    true,
  );
});

test("public key de producción: nunca una de prueba", () => {
  assert.equal(resolveProductionCardBrickPublicKey({} as NodeJS.ProcessEnv), null);
  assert.equal(
    resolveProductionCardBrickPublicKey({
      NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: "TEST-abc",
      MERCADOPAGO_LIVE_PUBLIC_KEY: "APP_USR-live",
    } as unknown as NodeJS.ProcessEnv),
    "APP_USR-live",
  );
  assert.equal(
    resolveProductionCardBrickPublicKey({
      NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: "APP_USR-pub",
    } as unknown as NodeJS.ProcessEnv),
    "APP_USR-pub",
  );
});
