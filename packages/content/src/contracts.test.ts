import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentEventPayloadSchema } from "./contracts/events";
import { submitContentToInfoSpotInputSchema } from "./contracts/infospot";

describe("content contracts", () => {
  it("accepts valid Info Spot submit payload", () => {
    const parsed = submitContentToInfoSpotInputSchema.safeParse({
      sourcePlatform: "compramelafoto",
      sourceContentId: "42",
      title: "Nota",
      contentHtml: "<p>Hola</p>",
      submittedByUserId: 1,
      submittedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    assert.equal(parsed.success, true);
  });

  it("rejects invalid Info Spot payload", () => {
    const parsed = submitContentToInfoSpotInputSchema.safeParse({
      sourcePlatform: "infospot",
      sourceContentId: "42",
      title: "Nota",
      contentHtml: "<p>Hola</p>",
      submittedByUserId: 1,
      submittedAt: new Date(),
    });
    assert.equal(parsed.success, false);
  });

  it("accepts valid ContentEventPayload", () => {
    const parsed = contentEventPayloadSchema.safeParse({
      platform: "clickaton",
      contentId: "1",
      slug: "hola",
      status: "PUBLISHED",
      occurredAt: new Date().toISOString(),
    });
    assert.equal(parsed.success, true);
  });

  it("rejects invalid ContentEventPayload", () => {
    const parsed = contentEventPayloadSchema.safeParse({
      platform: "clickaton",
      contentId: "1",
      slug: "hola",
      status: "SCHEDULED",
      occurredAt: new Date().toISOString(),
    });
    assert.equal(parsed.success, false);
  });
});
