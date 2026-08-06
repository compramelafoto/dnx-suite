import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendClearReferralCookies,
  getReferralCodeFromRequest,
  getReferralMetaFromRequest,
} from "./referral-cookie-server";

describe("referral-cookie-server", () => {
  it("lee clf_ref del header Cookie", () => {
    const req = new Request("https://example.com", {
      headers: { cookie: "clf_ref=SQZW2CCT; other=1" },
    });
    assert.equal(getReferralCodeFromRequest(req), "SQZW2CCT");
  });

  it("lee clf_ref_meta TRAINING", () => {
    const meta = encodeURIComponent(
      JSON.stringify({ sourceType: "TRAINING", sourceEntityId: 9 })
    );
    const req = new Request("https://example.com", {
      headers: { cookie: `clf_ref_meta=${meta}` },
    });
    assert.deepEqual(getReferralMetaFromRequest(req), {
      sourceType: "TRAINING",
      sourceEntityId: 9,
    });
  });

  it("appendClearReferralCookies agrega Max-Age=0", () => {
    const headers = new Headers();
    appendClearReferralCookies(headers);
    const cookies = headers.getSetCookie?.() ?? [];
    assert.ok(cookies.some((c) => c.includes("clf_ref=") && c.includes("Max-Age=0")));
    assert.ok(cookies.some((c) => c.includes("clf_ref_meta=") && c.includes("Max-Age=0")));
  });
});
