import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCancel,
  canConfirm,
  canDeliver,
  canMarkAvailable,
  canReplace,
  canRevoke,
  isConfirmedWinnerForEligibility,
  type PrizeAssignmentStateView,
} from "./state";

function view(
  partial: Partial<PrizeAssignmentStateView> &
    Pick<PrizeAssignmentStateView, "bundleStatus" | "decision">,
): PrizeAssignmentStateView {
  return {
    winnerRegistrationId: partial.winnerRegistrationId ?? null,
    deliveredAt: partial.deliveredAt ?? null,
    replacedAt: partial.replacedAt ?? null,
    bundleStatus: partial.bundleStatus,
    decision: partial.decision,
  };
}

describe("prize-assignment state transitions", () => {
  it("canMarkAvailable solo desde DRAFT o REPLACED", () => {
    assert.equal(canMarkAvailable({ bundleStatus: "DRAFT" }), true);
    assert.equal(canMarkAvailable({ bundleStatus: "REPLACED" }), true);
    assert.equal(canMarkAvailable({ bundleStatus: "AVAILABLE" }), false);
    assert.equal(canMarkAvailable({ bundleStatus: "ASSIGNED" }), false);
  });

  it("canConfirm desde AVAILABLE/REPLACED con decisión vacía o previa", () => {
    assert.equal(
      canConfirm(view({ bundleStatus: "AVAILABLE", decision: "NONE" })),
      true,
    );
    assert.equal(
      canConfirm(view({ bundleStatus: "AVAILABLE", decision: "PROPOSED" })),
      true,
    );
    assert.equal(
      canConfirm(view({ bundleStatus: "AVAILABLE", decision: "REVOKED" })),
      true,
    );
    assert.equal(
      canConfirm(
        view({
          bundleStatus: "ASSIGNED",
          decision: "CONFIRMED",
          winnerRegistrationId: "r1",
        }),
      ),
      false,
    );
  });

  it("canRevoke / canReplace requieren ganador confirmado", () => {
    const confirmed = view({
      bundleStatus: "ASSIGNED",
      decision: "CONFIRMED",
      winnerRegistrationId: "r1",
    });
    assert.equal(canRevoke(confirmed), true);
    assert.equal(canReplace(confirmed), true);
    assert.equal(
      canRevoke(view({ bundleStatus: "AVAILABLE", decision: "NONE" })),
      false,
    );
  });

  it("canCancel no permite entregados", () => {
    assert.equal(
      canCancel(
        view({
          bundleStatus: "ASSIGNED",
          decision: "CONFIRMED",
          winnerRegistrationId: "r1",
        }),
      ),
      true,
    );
    assert.equal(
      canCancel(
        view({
          bundleStatus: "DELIVERED",
          decision: "DELIVERED",
          winnerRegistrationId: "r1",
          deliveredAt: new Date(),
        }),
      ),
      false,
    );
  });

  it("canDeliver solo ASSIGNED+CONFIRMED", () => {
    assert.equal(
      canDeliver(
        view({
          bundleStatus: "ASSIGNED",
          decision: "CONFIRMED",
          winnerRegistrationId: "r1",
        }),
      ),
      true,
    );
    assert.equal(
      canDeliver(
        view({
          bundleStatus: "AVAILABLE",
          decision: "NONE",
        }),
      ),
      false,
    );
  });

  it("isConfirmedWinnerForEligibility cubre ASSIGNED y DELIVERED", () => {
    assert.equal(
      isConfirmedWinnerForEligibility({
        bundleStatus: "ASSIGNED",
        decision: "CONFIRMED",
        winnerRegistrationId: "r1",
      }),
      true,
    );
    assert.equal(
      isConfirmedWinnerForEligibility({
        bundleStatus: "DELIVERED",
        decision: "DELIVERED",
        winnerRegistrationId: "r1",
      }),
      true,
    );
    assert.equal(
      isConfirmedWinnerForEligibility({
        bundleStatus: "AVAILABLE",
        decision: "REVOKED",
        winnerRegistrationId: null,
      }),
      false,
    );
  });
});
