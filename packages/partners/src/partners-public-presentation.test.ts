import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PARTNER_LOGO_MARQUEE_THRESHOLD,
  classifyPartnerPublicationReadiness,
  partnerLogoAlt,
  partnerTrackingKeyFromHref,
  presentPartnerGroupsForPublic,
  resolvePartnerGroupPresentation,
  resolvePartnerLinkRel,
  resolvePartnerLogoVisualSize,
  resolvePartnerPublicPresentation,
} from "./public-presentation";
import { groupPartnersForPublicDisplay, type PublicPartnerDisplayItem } from "./institutional";

function item(
  partial: Partial<PublicPartnerDisplayItem> &
    Pick<PublicPartnerDisplayItem, "participationId" | "partnerName" | "institutionalRole">,
): PublicPartnerDisplayItem {
  return {
    partnerId: partial.partnerId ?? partial.participationId,
    displayTier: partial.displayTier ?? "STANDARD",
    displayOrder: partial.displayOrder ?? 100,
    publicRoleLabel: partial.publicRoleLabel ?? null,
    resolvedRoleLabel: partial.resolvedRoleLabel ?? partial.institutionalRole,
    status: partial.status ?? "CONFIRMED",
    publicVisibility: partial.publicVisibility ?? "PUBLIC",
    logoUrl: partial.logoUrl ?? null,
    websiteUrl: partial.websiteUrl ?? null,
    ...partial,
  };
}

describe("resolvePartnerPublicPresentation", () => {
  it("keeps organizers/co-organizers/main in GRID", () => {
    for (const role of ["ORGANIZER", "CO_ORGANIZER", "MAIN_SPONSOR", "INSTITUTIONAL_SPONSOR"] as const) {
      const d = resolvePartnerPublicPresentation({ role, itemCount: 10 });
      assert.equal(d.mode, "GRID", role);
      assert.equal(d.marqueeEligible, false, role);
    }
  });

  it("uses GRID for 1–3 sponsors and MARQUEE for 4+", () => {
    assert.equal(
      resolvePartnerPublicPresentation({ role: "SPONSOR", itemCount: 1 }).mode,
      "GRID",
    );
    assert.equal(
      resolvePartnerPublicPresentation({ role: "SPONSOR", itemCount: 3 }).mode,
      "GRID",
    );
    assert.equal(
      resolvePartnerPublicPresentation({ role: "SPONSOR", itemCount: 4 }).mode,
      "MARQUEE",
    );
    assert.equal(
      resolvePartnerPublicPresentation({ role: "COLLABORATOR", itemCount: 5 }).mode,
      "MARQUEE",
    );
    assert.equal(PARTNER_LOGO_MARQUEE_THRESHOLD, 4);
  });

  it("respects forceGrid and custom threshold", () => {
    assert.equal(
      resolvePartnerPublicPresentation({
        role: "SPONSOR",
        itemCount: 10,
        forceGrid: true,
      }).mode,
      "GRID",
    );
    assert.equal(
      resolvePartnerPublicPresentation({
        role: "MEDIA_PARTNER",
        itemCount: 3,
        marqueeThreshold: 3,
      }).mode,
      "MARQUEE",
    );
  });

  it("hides supplier via grouping and presents remaining modes", () => {
    const groups = groupPartnersForPublicDisplay([
      item({
        participationId: "o1",
        partnerName: "Org",
        institutionalRole: "ORGANIZER",
        displayTier: "INSTITUTIONAL",
        displayOrder: 10,
      }),
      item({
        participationId: "s1",
        partnerName: "S1",
        institutionalRole: "SPONSOR",
        displayOrder: 10,
      }),
      item({
        participationId: "s2",
        partnerName: "S2",
        institutionalRole: "SPONSOR",
        displayOrder: 20,
      }),
      item({
        participationId: "s3",
        partnerName: "S3",
        institutionalRole: "SPONSOR",
        displayOrder: 30,
      }),
      item({
        participationId: "s4",
        partnerName: "S4",
        institutionalRole: "SPONSOR",
        displayOrder: 40,
      }),
      item({
        participationId: "sup",
        partnerName: "Supplier",
        institutionalRole: "SUPPLIER",
        displayOrder: 90,
      }),
    ]);
    const presented = presentPartnerGroupsForPublic(groups);
    assert.deepEqual(
      presented.map((g) => g.role),
      ["ORGANIZER", "SPONSOR"],
    );
    assert.equal(presented[0]?.presentation.mode, "GRID");
    assert.equal(presented[1]?.presentation.mode, "MARQUEE");
    assert.equal(resolvePartnerGroupPresentation(presented[1]!).mode, "MARQUEE");
  });
});

describe("partner link helpers", () => {
  it("builds alt and tracking key; clickable only with href", () => {
    assert.equal(partnerLogoAlt("Acme"), "Logo de Acme");
    assert.equal(partnerTrackingKeyFromHref("/r/abc123"), "abc123");
    assert.equal(partnerTrackingKeyFromHref("/r/abc123?x=1"), "abc123");
    assert.equal(partnerTrackingKeyFromHref("https://example.com"), null);
  });

  it("adds sponsored rel for commercial roles", () => {
    assert.ok(
      resolvePartnerLinkRel({
        institutionalRole: "SPONSOR",
        href: "/r/key",
      })?.includes("sponsored"),
    );
    assert.ok(
      !resolvePartnerLinkRel({
        institutionalRole: "ORGANIZER",
        href: "/r/key",
      })?.includes("sponsored"),
    );
  });

  it("maps display tiers to visual sizes", () => {
    assert.equal(resolvePartnerLogoVisualSize("INSTITUTIONAL"), "lg");
    assert.equal(resolvePartnerLogoVisualSize("MAIN"), "md");
    assert.equal(resolvePartnerLogoVisualSize("STANDARD"), "sm");
    assert.equal(resolvePartnerLogoVisualSize("SUPPORTING"), "xs");
  });
});

describe("classifyPartnerPublicationReadiness", () => {
  it("classifies prospect, missing logo, ready, already public, missing destination flag", () => {
    assert.equal(
      classifyPartnerPublicationReadiness({
        partnerStatus: "PROSPECT",
        participationStatus: "DRAFT",
        publicVisibility: "HIDDEN",
        hasApprovedLogo: false,
        hasDestinationUrl: false,
      }).primary,
      "PROSPECT",
    );

    assert.equal(
      classifyPartnerPublicationReadiness({
        partnerStatus: "ACTIVE",
        participationStatus: "CONFIRMED",
        publicVisibility: "HIDDEN",
        hasApprovedLogo: false,
        hasDestinationUrl: true,
        partnerType: "COMPANY",
      }).primary,
      "MISSING_LOGO",
    );

    const ready = classifyPartnerPublicationReadiness({
      partnerStatus: "ACTIVE",
      participationStatus: "CONFIRMED",
      publicVisibility: "HIDDEN",
      hasApprovedLogo: true,
      hasDestinationUrl: false,
      partnerType: "COMPANY",
    });
    assert.equal(ready.primary, "READY_TO_PUBLISH");
    assert.ok(ready.flags.includes("MISSING_DESTINATION"));

    assert.equal(
      classifyPartnerPublicationReadiness({
        partnerStatus: "ACTIVE",
        participationStatus: "ACTIVE",
        publicVisibility: "PUBLIC",
        hasApprovedLogo: true,
        hasDestinationUrl: true,
        partnerType: "COMPANY",
      }).primary,
      "ALREADY_PUBLIC",
    );
  });
});
