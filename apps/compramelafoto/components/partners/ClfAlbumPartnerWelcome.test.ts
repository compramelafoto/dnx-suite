import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canMountPartnerWelcomeActivation,
  isClfPartnerAdsEnabled,
  isClfPartnerAlbumWelcomeEnabled,
} from "@repo/partners";
import {
  CLF_ALBUM_WELCOME_APPEAR_DELAY_MS,
  CLF_ALBUM_WELCOME_PLACEMENT,
} from "../../lib/public/partners-album-welcome-shared";

const here = dirname(fileURLToPath(import.meta.url));

describe("CLF ALBUM welcome flags", () => {
  it("cualquiera OFF ⇒ no consulta; ambos truthy permiten", () => {
    const prevAds = process.env.CLF_PARTNER_ADS_ENABLED;
    const prevWelcome = process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED;
    try {
      delete process.env.CLF_PARTNER_ADS_ENABLED;
      delete process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED;
      assert.equal(isClfPartnerAdsEnabled(), false);
      assert.equal(isClfPartnerAlbumWelcomeEnabled(), false);

      process.env.CLF_PARTNER_ADS_ENABLED = "true";
      process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED = "false";
      assert.equal(isClfPartnerAdsEnabled(), true);
      assert.equal(isClfPartnerAlbumWelcomeEnabled(), false);

      process.env.CLF_PARTNER_ADS_ENABLED = "false";
      process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED = "true";
      assert.equal(isClfPartnerAdsEnabled(), false);
      assert.equal(isClfPartnerAlbumWelcomeEnabled(), true);

      for (const v of ["1", "true", "on", "yes"]) {
        process.env.CLF_PARTNER_ADS_ENABLED = v;
        process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED = v;
        assert.equal(isClfPartnerAdsEnabled(), true, v);
        assert.equal(isClfPartnerAlbumWelcomeEnabled(), true, v);
      }

      process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED = "maybe";
      assert.equal(isClfPartnerAlbumWelcomeEnabled(), false);
    } finally {
      if (prevAds === undefined) delete process.env.CLF_PARTNER_ADS_ENABLED;
      else process.env.CLF_PARTNER_ADS_ENABLED = prevAds;
      if (prevWelcome === undefined) delete process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED;
      else process.env.CLF_PARTNER_ALBUM_WELCOME_ENABLED = prevWelcome;
    }
  });
});

describe("CLF ALBUM welcome surfaces", () => {
  it("álbum público permitido; home y funnel comercial bloqueados", () => {
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: CLF_ALBUM_WELCOME_PLACEMENT,
        pathname: "/album/mi-casamiento",
      }).ok,
      true,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: "CLF_HOME_WELCOME",
        pathname: "/",
      }).ok,
      true,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: CLF_ALBUM_WELCOME_PLACEMENT,
        pathname: "/",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: CLF_ALBUM_WELCOME_PLACEMENT,
        pathname: "/g/evento-slug",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: CLF_ALBUM_WELCOME_PLACEMENT,
        pathname: "/carrito",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: CLF_ALBUM_WELCOME_PLACEMENT,
        pathname: "/checkout",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: CLF_ALBUM_WELCOME_PLACEMENT,
        pathname: "/a/12/comprar",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: CLF_ALBUM_WELCOME_PLACEMENT,
        pathname: "/fotografo/panel",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: CLF_ALBUM_WELCOME_PLACEMENT,
        pathname: "/organizador/landing",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: CLF_ALBUM_WELCOME_PLACEMENT,
        pathname: "/api/public/partners/impression",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "COMPRAME_LA_FOTO",
        placementKey: CLF_ALBUM_WELCOME_PLACEMENT,
        pathname: "/descargas",
      }).ok,
      false,
    );
  });
});

describe("CLF ALBUM welcome wiring", () => {
  it("página monta wrapper + loader; OrganizerLandingSponsor intacto; no home", () => {
    const page = readFileSync(join(here, "../../app/album/[slug]/page.tsx"), "utf8");
    assert.match(page, /ClfAlbumPartnerWelcome/);
    assert.match(page, /loadClfAlbumWelcomeAd|resolveClfAlbumWelcomePayload/);
    assert.match(page, /String\(input\.albumId\)|albumId:\s*String\(/);
    assert.match(page, /isAlbumPubliclyAccessible/);
    assert.doesNotMatch(page, /CLF_HOME_WELCOME/);
    assert.doesNotMatch(page, /OrganizerLandingSponsor/);

    const client = readFileSync(join(here, "ClfAlbumPartnerWelcome.tsx"), "utf8");
    assert.match(client, /PartnerWelcomeInterstitial/);
    assert.match(client, /CLF_ALBUM_WELCOME/);
    assert.match(client, /appearDelayMs=\{CLF_ALBUM_WELCOME_APPEAR_DELAY_MS\}/);
    assert.equal(CLF_ALBUM_WELCOME_APPEAR_DELAY_MS, 1000);
    assert.match(client, /welcomeMedia/);
    assert.doesNotMatch(client, /server-only|prisma/i);
  });

  it("loader server-only exige ambos flags; tracking /r + impression existentes", () => {
    const src = readFileSync(
      join(here, "../../lib/public/partners-album-welcome.ts"),
      "utf8",
    );
    assert.match(src, /server-only/);
    assert.match(src, /isClfPartnerAdsEnabled\(\)/);
    assert.match(src, /isClfPartnerAlbumWelcomeEnabled\(\)/);
    assert.match(src, /albumContextId/);
    assert.match(src, /requireActivePartner:\s*true/);

    const redirect = readFileSync(
      join(here, "../../app/r/[trackingKey]/route.ts"),
      "utf8",
    );
    assert.match(redirect, /resolveOutboundRedirect/);

    const impression = readFileSync(
      join(here, "../../app/api/public/partners/impression/route.ts"),
      "utf8",
    );
    assert.match(impression, /ingestPartnerImpression/);
    assert.match(impression, /COMPRAME_LA_FOTO/);
  });

  it("OrganizerLandingSponsor sigue en landing organizador (no álbum)", () => {
    const org = readFileSync(
      join(here, "../../lib/organizer-public-landing-server.ts"),
      "utf8",
    );
    assert.match(org, /organizerLandingSponsor|OrganizerLandingSponsor/i);
  });
});
