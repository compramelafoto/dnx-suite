import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MercadoPagoHttpClient } from "./mercado-pago-http-client.js";
import { MercadoPagoProductionWriteBlockedError } from "../../../errors/provider-errors.js";
import {
  fakeMercadoPagoConfig,
  fakeProductionConfig,
  SANDBOX_TEST_TOKEN,
} from "../testing/fixtures.js";
import { createMercadoPagoProviderConfig } from "./mercado-pago-environment.js";

describe("MercadoPagoHttpClient", () => {
  it("blocks POST in production by default (fail-closed)", async () => {
    const client = new MercadoPagoHttpClient(fakeProductionConfig());
    await assert.rejects(
      () => client.request({ method: "POST", path: "/v1/orders", body: {} }),
      MercadoPagoProductionWriteBlockedError,
    );
  });

  it("allows POST in production when allowProductionWrites is set", async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response(JSON.stringify({ id: "ok" }), { status: 201 });
    };
    const config = createMercadoPagoProviderConfig({
      environment: "production",
      accessToken: "APP_USR-live-collector-oauth",
      allowProductionWrites: true,
    });
    const client = new MercadoPagoHttpClient(config, fetchImpl);
    await client.request({
      method: "POST",
      path: "/checkout/preferences",
      body: {},
      idempotencyKey: crypto.randomUUID(),
      accessTokenOverride: "APP_USR-live-collector-oauth",
    });
    assert.equal(called, true);
  });

  it("blocks POST without sandbox-eligible token", async () => {
    const config = createMercadoPagoProviderConfig({
      environment: "sandbox",
      accessToken: "INVALID-not-sandbox",
    });
    const client = new MercadoPagoHttpClient(config);
    await assert.rejects(
      () => client.request({ method: "POST", path: "/v1/orders", body: {} }),
      MercadoPagoProductionWriteBlockedError,
    );
  });

  it("allows APP_USR- token in sandbox (MLA test panel)", async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response(JSON.stringify({ id: "ok" }), { status: 201 });
    };
    const config = createMercadoPagoProviderConfig({
      environment: "sandbox",
      accessToken: "APP_USR-fake-test-panel",
    });
    const client = new MercadoPagoHttpClient(config, fetchImpl);
    await client.request({ method: "POST", path: "/v1/orders", body: {}, idempotencyKey: crypto.randomUUID() });
    assert.equal(called, true);
  });

  it("retries 503 with same idempotency key", async () => {
    let calls = 0;
    const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
      calls++;
      if (calls < 3) {
        return new Response(JSON.stringify({ message: "unavailable" }), { status: 503 });
      }
      return new Response(JSON.stringify({ id: "order-ok" }), { status: 201 });
    };

    const client = new MercadoPagoHttpClient(fakeMercadoPagoConfig(), fetchImpl);
    const result = await client.request<{ id: string }>({
      method: "POST",
      path: "/v1/orders",
      body: { test: true },
      idempotencyKey: "idem-123",
    });

    assert.equal(result.body?.id, "order-ok");
    assert.equal(calls, 3);
  });

  it("does not retry 400 errors", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return new Response(JSON.stringify({ message: "bad request" }), { status: 400 });
    };

    const client = new MercadoPagoHttpClient(fakeMercadoPagoConfig(), fetchImpl);
    await assert.rejects(
      () =>
        client.request({
          method: "POST",
          path: "/v1/orders",
          body: {},
          idempotencyKey: "idem-400",
        }),
      (err: Error) => err.name === "PaymentProviderValidationError",
    );
    assert.equal(calls, 1);
  });

  it("never includes token in error messages", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({ message: `Authorization failed for Bearer ${SANDBOX_TEST_TOKEN}` }),
        { status: 401 },
      );

    const client = new MercadoPagoHttpClient(fakeMercadoPagoConfig(), fetchImpl);
    try {
      await client.request({ method: "GET", path: "/v1/orders/1" });
      assert.fail("expected error");
    } catch (err) {
      const message = (err as Error).message;
      assert.ok(!message.includes("TEST-fake"));
      assert.ok(!message.includes(SANDBOX_TEST_TOKEN));
    }
  });

  it("adds x-test-token header in sandbox", async () => {
    let capturedHeaders: Headers | undefined;
    const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ receivers: [] }), { status: 200 });
    };

    const client = new MercadoPagoHttpClient(fakeMercadoPagoConfig(), fetchImpl);
    await client.request({ method: "GET", path: "/v1/split-consent" });
    assert.equal(capturedHeaders?.get("x-test-token"), "true");
  });

  it("sends empty string body when emptyBody is set (Orders total refund)", async () => {
    let capturedBody: BodyInit | null | undefined;
    const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body;
      return new Response(JSON.stringify({ id: "ORD1", status: "processed" }), {
        status: 201,
      });
    };
    const client = new MercadoPagoHttpClient(fakeMercadoPagoConfig(), fetchImpl);
    await client.request({
      method: "POST",
      path: "/v1/orders/ORD1/refund",
      emptyBody: true,
      idempotencyKey: "idem-1",
    });
    assert.equal(capturedBody, "");
  });
});
