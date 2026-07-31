import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { actor, FIXTURE_USERS, grant } from "../testing/financial-fixtures.js";
import {
  canConnectOwnMpAccount,
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

  it("VIEW ≠ CONNECT OWN ≠ MANAGE GLOBAL — partner connect matrix", () => {
    const viewer = actor(4, [grant(4, "PRODUCT_FINANCE_VIEWER", "clickaton")]);
    const partner = actor(6, [grant(6, "DNX_FINANCE_PARTNER_CONNECT")]);
    const owner = actor(1, [grant(1, "DNX_FINANCE_OWNER")]);

    assert.equal(
      canPerformFinanceAction(viewer, "view_own_mp_account", { productKey: "clickaton" }),
      true,
    );
    assert.equal(canPerformFinanceAction(viewer, "connect_own_mp_account"), false);
    assert.equal(canPerformFinanceAction(viewer, "publish_distribution", { productKey: "clickaton" }), false);

    assert.equal(canPerformFinanceAction(partner, "connect_own_mp_account"), true);
    assert.equal(canPerformFinanceAction(partner, "revoke_own_mp_account"), true);
    assert.equal(
      canPerformFinanceAction(partner, "publish_distribution", { productKey: "clickaton" }),
      false,
    );
    assert.equal(canPerformFinanceAction(partner, "manage_suite_finance"), false);

    assert.equal(canPerformFinanceAction(owner, "connect_own_mp_account"), true);
    assert.equal(canPerformFinanceAction(owner, "manage_suite_finance"), true);
  });

  it("SUPER_ADMIN ≠ automatic PARTNER_CONNECT — grant must be explicit", () => {
    // globalRole SUPER_ADMIN vive fuera de FinanceActor; sin grant no hay connect.
    const superAdminNoFinanceGrant = actor(99, []);
    assert.equal(
      canPerformFinanceAction(superAdminNoFinanceGrant, "connect_own_mp_account"),
      false,
    );
    assert.equal(
      canPerformFinanceAction(superAdminNoFinanceGrant, "revoke_own_mp_account"),
      false,
    );
    assert.equal(canConnectOwnMpAccount(superAdminNoFinanceGrant), false);

    const superAdminWithExplicitConnect = actor(99, [
      grant(99, "DNX_FINANCE_PARTNER_CONNECT"),
    ]);
    assert.equal(
      canPerformFinanceAction(superAdminWithExplicitConnect, "connect_own_mp_account"),
      true,
    );
    assert.equal(canConnectOwnMpAccount(superAdminWithExplicitConnect), true);
    assert.equal(
      canPerformFinanceAction(superAdminWithExplicitConnect, "manage_suite_finance"),
      false,
    );
    assert.equal(
      canPerformFinanceAction(superAdminWithExplicitConnect, "publish_distribution", {
        productKey: "clickaton",
      }),
      false,
    );
  });
});
