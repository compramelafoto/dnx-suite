import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { actor, FIXTURE_USERS, grant } from "../testing/financial-fixtures.js";
import {
  canPerformFinanceAction,
  isClickatonAdminWithoutFinanceGrant,
} from "./check.js";

describe("Finance permissions", () => {
  it("owner can everything; admin can ops but not suite ownership redefine", () => {
    const owner = actor(1, [grant(1, "DNX_FINANCE_OWNER")]);
    const admin = actor(2, [grant(2, "DNX_FINANCE_ADMIN")]);
    assert.equal(canPerformFinanceAction(owner, "manage_suite_finance"), true);
    assert.equal(canPerformFinanceAction(owner, "publish_distribution", { productKey: "x" }), true);
    assert.equal(canPerformFinanceAction(admin, "ops_finance"), true);
    assert.equal(canPerformFinanceAction(admin, "manage_suite_finance"), false);
    assert.equal(
      canPerformFinanceAction(admin, "publish_distribution", { productKey: "clickaton" }),
      true,
    );
  });

  it("product manager scoped; viewer read-only; participant self limited", () => {
    const manager = actor(3, [grant(3, "PRODUCT_FINANCE_MANAGER", "clickaton")]);
    const viewer = actor(4, [grant(4, "PRODUCT_FINANCE_VIEWER", "clickaton")]);
    const self = actor(5, [], ["fi_self"]);

    assert.equal(
      canPerformFinanceAction(manager, "publish_distribution", { productKey: "clickaton" }),
      true,
    );
    assert.equal(
      canPerformFinanceAction(manager, "publish_distribution", { productKey: "fotorank" }),
      false,
    );
    assert.equal(
      canPerformFinanceAction(viewer, "view_agreement", { productKey: "clickaton" }),
      true,
    );
    assert.equal(
      canPerformFinanceAction(viewer, "publish_distribution", { productKey: "clickaton" }),
      false,
    );
    assert.equal(
      canPerformFinanceAction(self, "accept_participation", {
        financialIdentityId: "fi_self",
      }),
      true,
    );
    assert.equal(
      canPerformFinanceAction(self, "publish_distribution", { productKey: "clickaton" }),
      false,
    );
  });

  it("clickaton admin without finance grant cannot change percentages", () => {
    const adminNoFinance = actor(FIXTURE_USERS.clickatonAdminNoFinance.userId, []);
    assert.equal(
      isClickatonAdminWithoutFinanceGrant(true, adminNoFinance, "clickaton"),
      true,
    );
    assert.equal(
      canPerformFinanceAction(adminNoFinance, "publish_distribution", {
        productKey: "clickaton",
      }),
      false,
    );
  });
});
