import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canMountPartnerWelcomeActivation,
  isFotorankPartnerWelcomeEnabled,
} from "@repo/partners";
import {
  FOTORANK_CONTEST_WELCOME_APPEAR_DELAY_MS,
  FOTORANK_CONTEST_WELCOME_PLACEMENT,
} from "../../lib/fotorank/partners/contest-welcome-shared";

const here = dirname(fileURLToPath(import.meta.url));

describe("FotoRank CONTEST welcome flag", () => {
  it("ausente / false / inválido ⇒ OFF; truthy solo 1|true|on|yes", () => {
    const prev = process.env.FOTORANK_PARTNER_WELCOME_ENABLED;
    try {
      delete process.env.FOTORANK_PARTNER_WELCOME_ENABLED;
      assert.equal(isFotorankPartnerWelcomeEnabled(), false);
      process.env.FOTORANK_PARTNER_WELCOME_ENABLED = "false";
      assert.equal(isFotorankPartnerWelcomeEnabled(), false);
      process.env.FOTORANK_PARTNER_WELCOME_ENABLED = "maybe";
      assert.equal(isFotorankPartnerWelcomeEnabled(), false);
      for (const v of ["1", "true", "on", "yes", "TRUE"]) {
        process.env.FOTORANK_PARTNER_WELCOME_ENABLED = v;
        assert.equal(isFotorankPartnerWelcomeEnabled(), true, v);
      }
    } finally {
      if (prev === undefined) delete process.env.FOTORANK_PARTNER_WELCOME_ENABLED;
      else process.env.FOTORANK_PARTNER_WELCOME_ENABLED = prev;
    }
  });
});

describe("FotoRank CONTEST welcome surfaces", () => {
  it("landing pública permitida; home y funnel crítico bloqueados", () => {
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "FOTO_RANK",
        placementKey: FOTORANK_CONTEST_WELCOME_PLACEMENT,
        pathname: "/concursos/santa-fe-en-foco",
      }).ok,
      true,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "FOTO_RANK",
        placementKey: "FOTORANK_HOME_WELCOME",
        pathname: "/",
      }).ok,
      true,
    );
    // HOME placement no montado en esta etapa; contest placement no vale en home:
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "FOTO_RANK",
        placementKey: FOTORANK_CONTEST_WELCOME_PLACEMENT,
        pathname: "/",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "FOTO_RANK",
        placementKey: FOTORANK_CONTEST_WELCOME_PLACEMENT,
        pathname: "/concursos/santa-fe-en-foco/inscripcion",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "FOTO_RANK",
        placementKey: FOTORANK_CONTEST_WELCOME_PLACEMENT,
        pathname: "/dashboard/concursos/1/admision",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "FOTO_RANK",
        placementKey: FOTORANK_CONTEST_WELCOME_PLACEMENT,
        pathname: "/jurado/panel",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "FOTO_RANK",
        placementKey: FOTORANK_CONTEST_WELCOME_PLACEMENT,
        pathname: "/login",
      }).ok,
      false,
    );
    assert.equal(
      canMountPartnerWelcomeActivation({
        application: "FOTO_RANK",
        placementKey: FOTORANK_CONTEST_WELCOME_PLACEMENT,
        pathname: "/api/public/partners/impression",
      }).ok,
      false,
    );
  });
});

describe("FotoRank CONTEST welcome wiring", () => {
  it("página monta wrapper + loader sobre public-ui; no home", () => {
    const page = readFileSync(join(here, "../../concursos/[slug]/page.tsx"), "utf8");
    assert.match(page, /FotorankContestPartnerWelcome/);
    assert.match(page, /loadFotorankContestWelcomeAd/);
    assert.match(page, /contestId:\s*data\.contest\.id/);
    assert.doesNotMatch(page, /partnerGroups=\{/);
    assert.doesNotMatch(page, /FOTORANK_HOME_WELCOME/);
    assert.match(page, /ContestPublicLanding/);
    assert.match(page, /components\/partners\/FotorankContestPartnerWelcome/);

    const client = readFileSync(
      join(here, "FotorankContestPartnerWelcome.tsx"),
      "utf8",
    );
    assert.match(client, /PartnerWelcomeInterstitial/);
    assert.match(client, /FOTORANK_CONTEST_WELCOME/);
    assert.match(client, /appearDelayMs=\{FOTORANK_CONTEST_WELCOME_APPEAR_DELAY_MS\}/);
    assert.equal(FOTORANK_CONTEST_WELCOME_APPEAR_DELAY_MS, 1000);
    assert.doesNotMatch(client, /server-only|prisma/i);
  });

  it("loader server-only corta con flag OFF; tracking /r + impression presentes", () => {
    const src = readFileSync(
      join(here, "../../lib/fotorank/partners/contest-welcome.ts"),
      "utf8",
    );
    assert.match(src, /server-only/);
    assert.match(src, /isFotorankPartnerWelcomeEnabled\(\)/);
    assert.match(src, /contestContextId/);
    assert.match(src, /requireActivePartner:\s*true/);

    const redirect = readFileSync(
      join(here, "../../r/[trackingKey]/route.ts"),
      "utf8",
    );
    assert.match(redirect, /resolveOutboundRedirect/);

    const impression = readFileSync(
      join(here, "../../api/public/partners/impression/route.ts"),
      "utf8",
    );
    assert.match(impression, /ingestPartnerImpression/);
    assert.match(impression, /FOTO_RANK/);
  });

  it("landing pública usa public-ui (no contest-public)", () => {
    const landing = readFileSync(
      join(here, "../../concursos/[slug]/ContestPublicLanding.tsx"),
      "utf8",
    );
    assert.match(landing, /public-ui/);
    assert.doesNotMatch(landing, /from ["'].*contest-public/);
  });
});
