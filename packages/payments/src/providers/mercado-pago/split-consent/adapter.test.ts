import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MercadoPagoSplitConsentAdapter } from "./adapter.js";
import { FakeMercadoPagoHttpClient } from "../testing/fake-client.js";
import {
  fakeConsentCreateResponse,
  fakeConsentListResponse,
  fakeMercadoPagoConfig,
  FAKE_CONSENT_RECEIVER_ID,
} from "../testing/fixtures.js";
import { mapMpConsentStatusToDomain } from "./mapper.js";

describe("MercadoPagoSplitConsentAdapter", () => {
  it("invite creates consents", async () => {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    http.addRule({
      match: (o) => o.method === "POST" && o.path === "/v1/split-consent",
      response: {
        status: 201,
        headers: new Headers(),
        body: fakeConsentCreateResponse,
        rawText: JSON.stringify(fakeConsentCreateResponse),
        problem: null,
      },
    });

    const adapter = new MercadoPagoSplitConsentAdapter({
      config: fakeMercadoPagoConfig(),
      httpClient: http,
    });
    const results = await adapter.invite({
      environment: "sandbox",
      sellerEmails: ["TESTUSER123@testuser.com"],
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    });

    assert.equal(results.length, 1);
    assert.equal(results[0]?.receiverId, FAKE_CONSENT_RECEIVER_ID);
    assert.equal(results[0]?.status, "PENDING");
    assert.equal(http.recordedRequests[0]?.options.idempotencyKey, "550e8400-e29b-41d4-a716-446655440000");
  });

  it("maps consent statuses to domain", () => {
    assert.equal(mapMpConsentStatusToDomain("ACTIVE"), "ACTIVE");
    assert.equal(mapMpConsentStatusToDomain("pending"), "PENDING");
  });

  it("list returns consents", async () => {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    http.addRule({
      match: (o) => o.method === "GET" && o.path === "/v1/split-consent",
      response: {
        status: 200,
        headers: new Headers(),
        body: fakeConsentListResponse,
        rawText: "",
        problem: null,
      },
    });

    const adapter = new MercadoPagoSplitConsentAdapter({
      config: fakeMercadoPagoConfig(),
      httpClient: http,
    });
    const list = await adapter.list({ environment: "sandbox" });
    assert.equal(list.length, 1);
  });

  it("getConsent filters by receiver_id", async () => {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    http.addRule({
      match: (o) => o.method === "GET",
      response: {
        status: 200,
        headers: new Headers(),
        body: fakeConsentListResponse,
        rawText: "",
        problem: null,
      },
    });

    const adapter = new MercadoPagoSplitConsentAdapter({
      config: fakeMercadoPagoConfig(),
      httpClient: http,
    });
    const consent = await adapter.getConsent(FAKE_CONSENT_RECEIVER_ID);
    assert.ok(consent);
    assert.equal(consent.receiverId, FAKE_CONSENT_RECEIVER_ID);
  });

  it("cancel patches consent to CANCELED", async () => {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    http.addRule({
      match: (o) => o.method === "PATCH",
      response: {
        status: 200,
        headers: new Headers(),
        body: { status: "CANCELED" },
        rawText: "",
        problem: null,
      },
    });
    const adapter = new MercadoPagoSplitConsentAdapter({
      config: fakeMercadoPagoConfig(),
      httpClient: http,
    });
    const result = await adapter.cancel({
      environment: "sandbox",
      receiverId: FAKE_CONSENT_RECEIVER_ID,
    });
    assert.equal(result.status, "CANCELED");
  });
});
