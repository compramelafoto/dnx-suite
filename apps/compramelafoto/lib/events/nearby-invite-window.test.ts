import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eventAcceptsNearbyInvites } from "@/lib/events/nearby-invite-window";

const now = new Date("2026-10-06T14:21:00.000Z");

describe("eventAcceptsNearbyInvites", () => {
  it("rechaza un evento cargado dos días después de terminar", () => {
    assert.equal(
      eventAcceptsNearbyInvites(
        {
          startsAt: new Date("2026-10-04T17:30:00.000Z"),
          endsAt: new Date("2026-10-04T20:00:00.000Z"),
        },
        now
      ),
      false
    );
  });

  it("acepta un evento futuro", () => {
    assert.equal(
      eventAcceptsNearbyInvites(
        { startsAt: new Date("2026-10-08T17:30:00.000Z"), endsAt: null },
        now
      ),
      true
    );
  });

  it("acepta un evento de varios días que ya empezó pero sigue en curso", () => {
    assert.equal(
      eventAcceptsNearbyInvites(
        {
          startsAt: new Date("2026-10-05T15:00:00.000Z"),
          endsAt: new Date("2026-10-09T20:00:00.000Z"),
        },
        now
      ),
      true
    );
  });

  it("sin hora de fin, usa la de inicio", () => {
    assert.equal(
      eventAcceptsNearbyInvites(
        { startsAt: new Date("2026-10-06T10:00:00.000Z"), endsAt: null },
        now
      ),
      false
    );
  });
});
