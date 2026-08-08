import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  groupPartnersForPublicDisplay,
  resolvePublicRoleLabel,
  type PublicPartnerDisplayItem,
} from "@repo/partners";
import { isClickatonPartnersPublicEnabled } from "./edition-partners-public";

describe("clickaton edition partners public", () => {
  it("kill-switch defaults to enabled unless explicitly false", () => {
    const prev = process.env.CLICKATON_PARTNERS_PUBLIC_ENABLED;
    delete process.env.CLICKATON_PARTNERS_PUBLIC_ENABLED;
    assert.equal(isClickatonPartnersPublicEnabled(), true);
    process.env.CLICKATON_PARTNERS_PUBLIC_ENABLED = "false";
    assert.equal(isClickatonPartnersPublicEnabled(), false);
    process.env.CLICKATON_PARTNERS_PUBLIC_ENABLED = "true";
    assert.equal(isClickatonPartnersPublicEnabled(), true);
    if (prev === undefined) delete process.env.CLICKATON_PARTNERS_PUBLIC_ENABLED;
    else process.env.CLICKATON_PARTNERS_PUBLIC_ENABLED = prev;
  });

  it("groups by institutional role and hides empty/SUPPLIER", () => {
    const items: PublicPartnerDisplayItem[] = [
      {
        participationId: "p1",
        partnerId: "a",
        partnerName: "Org A",
        institutionalRole: "ORGANIZER",
        displayTier: "INSTITUTIONAL",
        displayOrder: 10,
        publicRoleLabel: null,
        resolvedRoleLabel: resolvePublicRoleLabel("ORGANIZER", null),
        status: "ACTIVE",
      },
      {
        participationId: "p2",
        partnerId: "b",
        partnerName: "Supplier B",
        institutionalRole: "SUPPLIER",
        displayTier: "SUPPORTING",
        displayOrder: 90,
        publicRoleLabel: null,
        resolvedRoleLabel: resolvePublicRoleLabel("SUPPLIER", null),
        status: "ACTIVE",
      },
      {
        participationId: "p3",
        partnerId: "c",
        partnerName: "Collab C",
        institutionalRole: "COLLABORATOR",
        displayTier: "SUPPORTING",
        displayOrder: 20,
        publicRoleLabel: "Colaboran",
        resolvedRoleLabel: resolvePublicRoleLabel("COLLABORATOR", "Colaboran"),
        status: "ACTIVE",
      },
    ];
    const groups = groupPartnersForPublicDisplay(items);
    assert.deepEqual(
      groups.map((g) => g.role),
      ["ORGANIZER", "COLLABORATOR"],
    );
    assert.ok(groups.every((g) => g.items.length > 0));
  });
});
