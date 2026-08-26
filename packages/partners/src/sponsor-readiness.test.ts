import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInstagramProfileUrl,
  evaluatePartnerSponsorReadiness,
} from "./sponsor-readiness";

const basePartner = {
  email: null as string | null,
  websiteUrl: null as string | null,
  instagram: null as string | null,
  logoUrl: null as string | null,
};

test("incomplete sin contacto ni logo", () => {
  const r = evaluatePartnerSponsorReadiness({ partner: basePartner });
  assert.equal(r.level, "incomplete");
  assert.ok(r.missing.includes("contact_email"));
  assert.ok(r.missing.includes("logo"));
});

test("partial con logo pendiente y sin destino", () => {
  const r = evaluatePartnerSponsorReadiness({
    partner: basePartner,
    contacts: [{ email: "a@b.com", archivedAt: null }],
    assets: [
      {
        type: "LOGO_GENERAL",
        status: "ACTIVE",
        archivedAt: null,
        approvalStatus: "PENDING",
        fileUrl: "https://cdn.example/a.png",
        storageKey: null,
        backgroundType: "COLOR",
      },
    ],
  });
  assert.equal(r.level, "partial");
  assert.ok(r.missing.includes("logo_approval"));
  assert.ok(r.missing.includes("click_destination"));
});

test("ready con contacto, logo aprobado e instagram", () => {
  const r = evaluatePartnerSponsorReadiness({
    partner: { ...basePartner, instagram: "@marca" },
    contacts: [{ email: "a@b.com", archivedAt: null }],
    assets: [
      {
        type: "LOGO_GENERAL",
        status: "ACTIVE",
        archivedAt: null,
        approvalStatus: "APPROVED",
        fileUrl: "https://cdn.example/a.png",
        storageKey: null,
        backgroundType: "COLOR",
      },
    ],
  });
  assert.equal(r.level, "ready");
  assert.deepEqual(r.missing, []);
});

test("buildInstagramProfileUrl normaliza handles", () => {
  assert.equal(buildInstagramProfileUrl("@marca"), "https://www.instagram.com/marca/");
  assert.equal(
    buildInstagramProfileUrl("https://instagram.com/marca"),
    "https://instagram.com/marca",
  );
  assert.equal(buildInstagramProfileUrl(""), null);
});
