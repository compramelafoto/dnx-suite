import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  requireParticipantCardAdminAccess,
  requireParticipantCardReadAccess,
} from "../participant-card-authorization";
import { ClickatonCardError } from "../participant-card-errors";

const registration = {
  id: "reg-1",
  userId: 42,
  email: "owner@example.com",
};

describe("requireParticipantCardReadAccess", () => {
  it("throws 401 when participant actor has no identity", () => {
    assert.throws(
      () =>
        requireParticipantCardReadAccess(registration, {
          kind: "participant",
        }),
      (err: unknown) =>
        err instanceof ClickatonCardError &&
        err.code === "CLICKATON_CARD_UNAUTHORIZED" &&
        err.httpStatus === 401
    );
  });

  it("allows owner by userId", () => {
    assert.doesNotThrow(() =>
      requireParticipantCardReadAccess(registration, {
        kind: "participant",
        userId: 42,
      })
    );
  });

  it("allows owner by email case-insensitive", () => {
    assert.doesNotThrow(() =>
      requireParticipantCardReadAccess(registration, {
        kind: "participant",
        email: "Owner@Example.com",
      })
    );
  });

  it("returns 404 for alien participant (not 403)", () => {
    assert.throws(
      () =>
        requireParticipantCardReadAccess(registration, {
          kind: "participant",
          userId: 99,
          email: "other@example.com",
        }),
      (err: unknown) =>
        err instanceof ClickatonCardError &&
        err.code === "CLICKATON_CARD_NOT_FOUND" &&
        err.httpStatus === 404
    );
  });
});

describe("requireParticipantCardAdminAccess", () => {
  it("throws 403 for non-admin actor kind", () => {
    assert.throws(
      () =>
        requireParticipantCardAdminAccess({
          kind: "participant",
          userId: 1,
          email: "user@example.com",
        }),
      (err: unknown) =>
        err instanceof ClickatonCardError && err.code === "CLICKATON_CARD_FORBIDDEN"
    );
  });

  it("allows SUPER_ADMIN global role", () => {
    assert.doesNotThrow(() =>
      requireParticipantCardAdminAccess({
        kind: "admin",
        email: "admin@example.com",
        globalRole: "SUPER_ADMIN",
      })
    );
  });
});

describe("requireParticipantCardReadAccess as admin", () => {
  it("allows admin read without ownership", () => {
    assert.doesNotThrow(() =>
      requireParticipantCardReadAccess(registration, {
        kind: "admin",
        email: "admin@example.com",
        globalRole: "SUPER_ADMIN",
      })
    );
  });
});
