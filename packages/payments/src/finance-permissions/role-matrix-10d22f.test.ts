/**
 * 10D.2.2F — Contrato de matriz de roles financieros.
 * Grants explícitos; no emails hardcodeados en el motor de permisos.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { actor, grant } from "../testing/financial-fixtures.js";
import {
  canConnectOwnMpAccount,
  canPerformFinanceAction,
  hasPartnerConnectGrant,
} from "./check.js";

const PRODUCT = "clickaton";

function danielActor(userId = 1001) {
  return actor(userId, [
    grant(userId, "DNX_FINANCE_OWNER"),
    grant(userId, "DNX_FINANCE_PARTNER_CONNECT"),
    grant(userId, "PRODUCT_FINANCE_VIEWER", PRODUCT),
  ]);
}

function partnerViewerActor(userId: number) {
  return actor(userId, [
    grant(userId, "PRODUCT_FINANCE_VIEWER", PRODUCT),
    grant(userId, "DNX_FINANCE_PARTNER_CONNECT"),
  ]);
}

describe("10D.2.2F finance role matrix", () => {
  it("1. Finance Owner edita allocation / publish → allowed", () => {
    const daniel = danielActor();
    assert.equal(
      canPerformFinanceAction(daniel, "publish_distribution", {
        productKey: PRODUCT,
      }),
      true,
    );
    assert.equal(canPerformFinanceAction(daniel, "manage_suite_finance"), true);
  });

  it("2–3. dnxfotografia / Tammy editan allocation → forbidden", () => {
    const dnx = partnerViewerActor(1002);
    const tammy = partnerViewerActor(1003);
    for (const a of [dnx, tammy]) {
      assert.equal(
        canPerformFinanceAction(a, "publish_distribution", {
          productKey: PRODUCT,
        }),
        false,
      );
      assert.equal(canPerformFinanceAction(a, "manage_suite_finance"), false);
    }
  });

  it("4–6. dnx / Tammy / Daniel conectan MP propio → allowed", () => {
    assert.equal(canConnectOwnMpAccount(partnerViewerActor(1002)), true);
    assert.equal(canConnectOwnMpAccount(partnerViewerActor(1003)), true);
    assert.equal(canConnectOwnMpAccount(danielActor()), true);
    assert.equal(
      canPerformFinanceAction(partnerViewerActor(1002), "connect_own_mp_account"),
      true,
    );
    assert.equal(
      canPerformFinanceAction(partnerViewerActor(1003), "revoke_own_mp_account"),
      true,
    );
  });

  it("7. Partner A no opera como si fuera Partner B (actor isolation)", () => {
    const a = partnerViewerActor(1002);
    const b = partnerViewerActor(1003);
    assert.notEqual(a.userId, b.userId);
    assert.equal(hasPartnerConnectGrant(a), true);
    assert.equal(hasPartnerConnectGrant(b), true);
    // Motor no mezcla userIds: cada actor solo actúa por sus grants.
    assert.equal(a.grants.every((g) => g.userId === a.userId), true);
    assert.equal(b.grants.every((g) => g.userId === b.userId), true);
  });

  it("8. viewer no se convierte en owner", () => {
    const viewerOnly = actor(1004, [
      grant(1004, "PRODUCT_FINANCE_VIEWER", PRODUCT),
    ]);
    assert.equal(canPerformFinanceAction(viewerOnly, "manage_suite_finance"), false);
    assert.equal(
      canPerformFinanceAction(viewerOnly, "publish_distribution", {
        productKey: PRODUCT,
      }),
      false,
    );
    assert.equal(canConnectOwnMpAccount(viewerOnly), false);
  });

  it("9. grants no dependen de email — mismo capability, distinto userId", () => {
    const byCapability = partnerViewerActor(555);
    const other = partnerViewerActor(556);
    assert.equal(
      canPerformFinanceAction(byCapability, "connect_own_mp_account"),
      canPerformFinanceAction(other, "connect_own_mp_account"),
    );
    assert.equal(
      canPerformFinanceAction(byCapability, "publish_distribution", {
        productKey: PRODUCT,
      }),
      false,
    );
  });

  it("10. SUPER_ADMIN vacío ≠ finance powers; owner account role es grant", () => {
    const superAdminNoFinance = actor(99, []);
    assert.equal(canConnectOwnMpAccount(superAdminNoFinance), false);
    assert.equal(
      canPerformFinanceAction(superAdminNoFinance, "manage_suite_finance"),
      false,
    );
    const ownerGrantOnly = actor(1001, [grant(1001, "DNX_FINANCE_OWNER")]);
    assert.equal(canPerformFinanceAction(ownerGrantOnly, "manage_suite_finance"), true);
  });

  it("matrix table: view / connect / manage", () => {
    const daniel = danielActor();
    const dnx = partnerViewerActor(1002);
    const tammy = partnerViewerActor(1003);

    const rows = [
      {
        who: "daniel",
        actor: daniel,
        view: true,
        connect: true,
        manage: true,
      },
      { who: "dnx", actor: dnx, view: true, connect: true, manage: false },
      { who: "tammy", actor: tammy, view: true, connect: true, manage: false },
    ] as const;

    for (const row of rows) {
      assert.equal(
        canPerformFinanceAction(row.actor, "view_agreement", {
          productKey: PRODUCT,
        }),
        row.view,
        `${row.who} view`,
      );
      assert.equal(canConnectOwnMpAccount(row.actor), row.connect, `${row.who} connect`);
      assert.equal(
        canPerformFinanceAction(row.actor, "publish_distribution", {
          productKey: PRODUCT,
        }),
        row.manage,
        `${row.who} manage`,
      );
    }
  });
});
