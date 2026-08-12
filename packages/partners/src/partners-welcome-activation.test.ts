import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AD_PLACEMENT_CATALOG,
  WELCOME_ACTIVATION_CREATIVE_FORMAT,
  WELCOME_ACTIVATION_EXCLUDED_APPLICATIONS,
  WELCOME_ACTIVATION_PLACEMENT_KEYS,
  assertSafeCampaignDestination,
  assertWelcomeActivationTargetAllowed,
  canMountPartnerWelcomeActivation,
  isClickatonPartnerWelcomeEnabled,
  isFotorankPartnerWelcomeEnabled,
  isInfospotPartnerAdsEnabled,
  isWelcomeActivationExcludedApplication,
  isWelcomeActivationPlacementKey,
  listAdPlacementCatalogForAdminBinding,
  listWelcomeActivationCatalogEntries,
  pickWelcomeAnimationVariant,
  PARTNER_PUBLICATION_DATABASE_KEYS,
  resolvePublicationDatabaseKey,
} from "./index";
import { PartnersDomainError } from "./types";

describe("welcome activation catalog", () => {
  it("incluye placements autorizados y conserva INFOSPOT_HOME_WELCOME", () => {
    const keys = listWelcomeActivationCatalogEntries().map((e) => e.placementKey);
    for (const k of WELCOME_ACTIVATION_PLACEMENT_KEYS) {
      assert.ok(keys.includes(k), `faltante ${k}`);
    }
    assert.ok(keys.includes("INFOSPOT_HOME_WELCOME"));
    assert.ok(keys.includes("CLICKATON_HOME_WELCOME"));
    assert.ok(keys.includes("CLICKATON_EVENT_WELCOME"));
    assert.ok(keys.includes("FOTORANK_HOME_WELCOME"));
    assert.ok(keys.includes("FOTORANK_CONTEST_WELCOME"));
    assert.ok(keys.includes("CLF_HOME_WELCOME"));
    assert.ok(keys.includes("CLF_ALBUM_WELCOME"));
  });

  it("claves únicas en catálogo completo", () => {
    const seen = new Set<string>();
    for (const e of AD_PLACEMENT_CATALOG) {
      const id = `${e.application}:${e.placementKey}`;
      assert.equal(seen.has(id), false, `duplicado ${id}`);
      seen.add(id);
    }
  });

  it("welcome usa WELCOME_INTERSTITIAL y nunca FotoOffice", () => {
    for (const e of listWelcomeActivationCatalogEntries()) {
      assert.ok(e.allowedFormats.includes(WELCOME_ACTIVATION_CREATIVE_FORMAT));
      assert.notEqual(e.application, "FOTO_OFFICE");
      assert.ok(isWelcomeActivationPlacementKey(e.placementKey));
    }
    assert.ok(isWelcomeActivationExcludedApplication("FOTO_OFFICE"));
    assert.deepEqual([...WELCOME_ACTIVATION_EXCLUDED_APPLICATIONS], ["FOTO_OFFICE"]);
  });

  it("admin binding excluye FotoOffice y no inventa placements FO", () => {
    const admin = listAdPlacementCatalogForAdminBinding();
    assert.ok(admin.length > 0);
    assert.ok(admin.every((e) => e.application !== "FOTO_OFFICE"));
    assert.equal(
      AD_PLACEMENT_CATALOG.some((e) => e.application === "FOTO_OFFICE"),
      false,
    );
  });
});

describe("welcome FotoOffice exclusion", () => {
  it("rechaza target y mount", () => {
    assert.throws(
      () => assertWelcomeActivationTargetAllowed("FOTO_OFFICE"),
      (err: unknown) => err instanceof PartnersDomainError,
    );
    const mount = canMountPartnerWelcomeActivation({
      application: "FOTO_OFFICE",
      placementKey: "INFOSPOT_HOME_WELCOME",
      pathname: "/",
    });
    assert.equal(mount.ok, false);
    if (!mount.ok) assert.equal(mount.reason, "foto_office_excluded");
  });

  it("no publica a FotoOffice", () => {
    assert.equal(resolvePublicationDatabaseKey("FOTO_OFFICE"), null);
    assert.ok(!(PARTNER_PUBLICATION_DATABASE_KEYS as readonly string[]).includes("FOTO_OFFICE"));
  });
});

describe("welcome critical paths + allowlist", () => {
  it("autoriza rutas públicas válidas", () => {
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "INFO_SPOT",
        placementKey: "INFOSPOT_HOME_WELCOME",
        pathname: "/",
      }).ok,
      true,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "CLICKATON",
        placementKey: "CLICKATON_EVENT_WELCOME",
        pathname: "/maratones/rosario-2026",
      }).ok,
      true,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "FOTO_RANK",
        placementKey: "FOTORANK_CONTEST_WELCOME",
        pathname: "/concursos/santa-fe",
      }).ok,
      true,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: "CLF_ALBUM_WELCOME",
        pathname: "/g/abc123",
      }).ok,
      true,
    );
  });

  it("bloquea flujos críticos", () => {
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "CLICKATON",
        placementKey: "CLICKATON_EVENT_WELCOME",
        pathname: "/maratones/rosario-2026/inscripcion",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "CLICKATON",
        placementKey: "CLICKATON_HOME_WELCOME",
        pathname: "/admin/sponsors",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "FOTO_RANK",
        placementKey: "FOTORANK_HOME_WELCOME",
        pathname: "/dashboard/concursos/1/admision",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: "CLF_HOME_WELCOME",
        pathname: "/checkout",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "INFO_SPOT",
        placementKey: "INFOSPOT_HOME_WELCOME",
        pathname: "/admin",
      }).ok,
      false,
    );
  });

  it("no monta placement no-welcome aunque la ruta sea home", () => {
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "INFO_SPOT",
        placementKey: "INFOSPOT_HOME_TOP",
        pathname: "/",
      }).ok,
      false,
    );
  });
});

describe("welcome animation + destination safety", () => {
  it("random elige solo variantes admitidas", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      seen.add(pickWelcomeAnimationVariant("random", () => i / 40));
    }
    for (const v of seen) {
      assert.ok(["fade", "slide-left", "slide-right", "slide-up"].includes(v));
    }
    assert.equal(pickWelcomeAnimationVariant("fade"), "fade");
  });

  it("rechaza destinos inseguros", () => {
    assert.throws(() => assertSafeCampaignDestination("javascript:alert(1)"));
    assert.throws(() => assertSafeCampaignDestination("data:text/html,hi"));
    assert.ok(assertSafeCampaignDestination("https://example.com").startsWith("https://"));
    assert.equal(assertSafeCampaignDestination("/r/abc"), "/r/abc");
  });
});

describe("welcome feature flags default OFF", () => {
  it("clickaton/fotorank welcome y ads flags", () => {
    const prevC = process.env.CLICKATON_PARTNER_WELCOME_ENABLED;
    const prevF = process.env.FOTORANK_PARTNER_WELCOME_ENABLED;
    const prevI = process.env.INFOSPOT_PARTNER_ADS_ENABLED;
    try {
      delete process.env.CLICKATON_PARTNER_WELCOME_ENABLED;
      delete process.env.FOTORANK_PARTNER_WELCOME_ENABLED;
      delete process.env.INFOSPOT_PARTNER_ADS_ENABLED;
      assert.equal(isClickatonPartnerWelcomeEnabled(), false);
      assert.equal(isFotorankPartnerWelcomeEnabled(), false);
      assert.equal(isInfospotPartnerAdsEnabled(), false);
      process.env.CLICKATON_PARTNER_WELCOME_ENABLED = "true";
      assert.equal(isClickatonPartnerWelcomeEnabled(), true);
    } finally {
      if (prevC === undefined) delete process.env.CLICKATON_PARTNER_WELCOME_ENABLED;
      else process.env.CLICKATON_PARTNER_WELCOME_ENABLED = prevC;
      if (prevF === undefined) delete process.env.FOTORANK_PARTNER_WELCOME_ENABLED;
      else process.env.FOTORANK_PARTNER_WELCOME_ENABLED = prevF;
      if (prevI === undefined) delete process.env.INFOSPOT_PARTNER_ADS_ENABLED;
      else process.env.INFOSPOT_PARTNER_ADS_ENABLED = prevI;
    }
  });
});
