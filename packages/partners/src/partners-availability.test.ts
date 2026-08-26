import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BENEFIT_EXPIRING_SOON_DAYS,
  extractSafeHttpUrl,
  isBenefitCurrentlyAvailable,
  isBenefitExpiringSoon,
} from "./eligibility-availability";

describe("benefit availability helpers", () => {
  it("activo y vigente", () => {
    assert.equal(
      isBenefitCurrentlyAvailable({
        benefit: {
          status: "ACTIVE",
          archivedAt: null,
          startsAt: null,
          endsAt: new Date("2030-01-01"),
        },
        now: new Date("2026-01-01"),
      }),
      true,
    );
  });

  it("pausado / archivado / vencido", () => {
    assert.equal(
      isBenefitCurrentlyAvailable({
        benefit: {
          status: "PAUSED",
          archivedAt: null,
          startsAt: null,
          endsAt: null,
        },
      }),
      false,
    );
    assert.equal(
      isBenefitCurrentlyAvailable({
        benefit: {
          status: "ACTIVE",
          archivedAt: new Date(),
          startsAt: null,
          endsAt: null,
        },
      }),
      false,
    );
    assert.equal(
      isBenefitCurrentlyAvailable({
        benefit: {
          status: "ACTIVE",
          archivedAt: null,
          startsAt: null,
          endsAt: new Date("2020-01-01"),
        },
        now: new Date("2026-01-01"),
      }),
      false,
    );
  });

  it("participación cancelada", () => {
    assert.equal(
      isBenefitCurrentlyAvailable({
        benefit: {
          status: "ACTIVE",
          archivedAt: null,
          startsAt: null,
          endsAt: null,
        },
        participation: { status: "CANCELLED", archivedAt: null },
      }),
      false,
    );
  });

  it("expiring soon", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    assert.equal(isBenefitExpiringSoon({ endsAt: soon, now }), true);
    assert.equal(BENEFIT_EXPIRING_SOON_DAYS, 7);
    assert.equal(
      isBenefitExpiringSoon({
        endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        now,
      }),
      false,
    );
  });

  it("extractSafeHttpUrl", () => {
    assert.equal(
      extractSafeHttpUrl("Ver https://ok.example/x ahora"),
      "https://ok.example/x",
    );
    assert.equal(extractSafeHttpUrl("sin url"), null);
  });
});
