import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AD_PLACEMENT_CATALOG,
  WELCOME_ACTIVATION_CREATIVE_FORMAT,
  WELCOME_ACTIVATION_PLACEMENT_KEYS,
  assertSafeCampaignDestination,
  assertWelcomeActivationTargetAllowed,
  canMountPartnerWelcomeActivation,
  isClickatonPartnerWelcomeEnabled,
  isFotorankPartnerWelcomeEnabled,
  isInfospotPartnerAdsEnabled,
  isClfPartnerAdsEnabled,
  isClfPartnerAlbumWelcomeEnabled,
  isWelcomeActivationPlacementKey,
  listAdPlacementCatalogForAdminBinding,
  listWelcomeActivationCatalogEntries,
  pickWelcomeAnimationVariant,
  PARTNER_PUBLICATION_DATABASE_KEYS,
  resolvePublicationDatabaseKey,
} from "./index";

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

  it("toda superficie de bienvenida admite el formato canónico", () => {
    for (const e of listWelcomeActivationCatalogEntries()) {
      assert.ok(e.allowedFormats.includes(WELCOME_ACTIVATION_CREATIVE_FORMAT));
      assert.ok(isWelcomeActivationPlacementKey(e.placementKey));
    }
  });

  it("el admin binding ya incluye FotoOffice, con una sola superficie de bienvenida", () => {
    const admin = listAdPlacementCatalogForAdminBinding();
    assert.ok(admin.some((e) => e.placementKey === "FOTOFFICE_PORTAL_WELCOME"));

    // De todo el inventario de FotoOffice, solo la ventana del portal es
    // activación destacada. El resto —sponsors, slideshow, ficha, sorteo,
    // franja pública— no admite el formato ni entra en la allowlist.
    const fotoffice = AD_PLACEMENT_CATALOG.filter((e) => e.application === "FOTO_OFFICE");
    assert.equal(fotoffice.length, 6);
    const bienvenida = fotoffice.filter((e) =>
      isWelcomeActivationPlacementKey(e.placementKey),
    );
    assert.deepEqual(
      bienvenida.map((e) => e.placementKey),
      ["FOTOFFICE_PORTAL_WELCOME"],
    );
    for (const e of fotoffice) {
      if (e.placementKey === "FOTOFFICE_PORTAL_WELCOME") continue;
      assert.equal(
        e.allowedFormats.includes(WELCOME_ACTIVATION_CREATIVE_FORMAT),
        false,
        `${e.placementKey} admite interstitial y no debería`,
      );
    }
  });
});

describe("ventana de bienvenida en el portal del socio", () => {
  it("FotoOffice ya es un destino autorizado", () => {
    assert.doesNotThrow(() => assertWelcomeActivationTargetAllowed("FOTO_OFFICE"));
  });

  it("se monta en la portada del portal", () => {
    const mount = canMountPartnerWelcomeActivation({
      application: "FOTO_OFFICE",
      placementKey: "FOTOFFICE_PORTAL_WELCOME",
      pathname: "/portal",
    });
    assert.equal(mount.ok, true);
  });

  it("nunca interrumpe al socio que entra a pagar la cuota", () => {
    const mount = canMountPartnerWelcomeActivation({
      application: "FOTO_OFFICE",
      placementKey: "FOTOFFICE_PORTAL_WELCOME",
      pathname: "/portal/cuotas",
    });
    assert.equal(mount.ok, false);
    if (!mount.ok) assert.equal(mount.reason, "critical_path");
  });

  it("tampoco en el carnet ni en el alta pública", () => {
    for (const pathname of ["/portal/carnet", "/w/sfpr/asociarse"]) {
      const mount = canMountPartnerWelcomeActivation({
        application: "FOTO_OFFICE",
        placementKey: "FOTOFFICE_PORTAL_WELCOME",
        pathname,
      });
      assert.equal(mount.ok, false, `${pathname} no debería montar`);
    }
  });

  it("todavía no se publica a FotoOffice: sus superficies no están construidas", () => {
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
        pathname: "/album/mi-casamiento",
      }).ok,
      true,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: "CLF_ALBUM_WELCOME",
        pathname: "/g/abc123",
      }).ok,
      false,
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
  it("clickaton/fotorank/clf album welcome y ads flags", () => {
    const prevC = process.env.CLICKATON_PARTNER_WELCOME_ENABLED;
    const prevF = process.env.FOTORANK_PARTNER_WELCOME_ENABLED;
    const prevI = process.env.INFOSPOT_PARTNER_ADS_ENABLED;
    const prevClfAds = process.env.CLF_PARTNER_ADS_ENABLED;
    const prevClfAlbum = process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED;
    try {
      delete process.env.CLICKATON_PARTNER_WELCOME_ENABLED;
      delete process.env.FOTORANK_PARTNER_WELCOME_ENABLED;
      delete process.env.INFOSPOT_PARTNER_ADS_ENABLED;
      delete process.env.CLF_PARTNER_ADS_ENABLED;
      delete process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED;
      assert.equal(isClickatonPartnerWelcomeEnabled(), false);
      assert.equal(isFotorankPartnerWelcomeEnabled(), false);
      assert.equal(isInfospotPartnerAdsEnabled(), false);
      assert.equal(isClfPartnerAdsEnabled(), false);
      assert.equal(isClfPartnerAlbumWelcomeEnabled(), false);
      process.env.CLICKATON_PARTNER_WELCOME_ENABLED = "true";
      assert.equal(isClickatonPartnerWelcomeEnabled(), true);
      process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED = "1";
      assert.equal(isClfPartnerAlbumWelcomeEnabled(), true);
      process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED = "maybe";
      assert.equal(isClfPartnerAlbumWelcomeEnabled(), false);
    } finally {
      if (prevC === undefined) delete process.env.CLICKATON_PARTNER_WELCOME_ENABLED;
      else process.env.CLICKATON_PARTNER_WELCOME_ENABLED = prevC;
      if (prevF === undefined) delete process.env.FOTORANK_PARTNER_WELCOME_ENABLED;
      else process.env.FOTORANK_PARTNER_WELCOME_ENABLED = prevF;
      if (prevI === undefined) delete process.env.INFOSPOT_PARTNER_ADS_ENABLED;
      else process.env.INFOSPOT_PARTNER_ADS_ENABLED = prevI;
      if (prevClfAds === undefined) delete process.env.CLF_PARTNER_ADS_ENABLED;
      else process.env.CLF_PARTNER_ADS_ENABLED = prevClfAds;
      if (prevClfAlbum === undefined) delete process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED;
      else process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED = prevClfAlbum;
    }
  });
});
