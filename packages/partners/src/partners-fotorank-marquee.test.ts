import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isFotorankContestMarqueeEnabled,
  isFotorankHomeMarqueeEnabled,
  isFotorankPartnerWelcomeEnabled,
  isPartnerCampaignEligibleForContestContext,
  listLogoMarqueePlacementsForAdminUi,
  MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS,
  UNMOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS,
} from "./index";

describe("fotorank marquee flags", () => {
  it("ausentes = OFF; welcome no activa marquees; home/contest independientes", () => {
    delete process.env.FOTORANK_HOME_MARQUEE_ENABLED;
    delete process.env.FOTORANK_CONTEST_MARQUEE_ENABLED;
    delete process.env.FOTORANK_PARTNER_WELCOME_ENABLED;
    assert.equal(isFotorankHomeMarqueeEnabled(), false);
    assert.equal(isFotorankContestMarqueeEnabled(), false);
    assert.equal(isFotorankPartnerWelcomeEnabled(), false);

    process.env.FOTORANK_PARTNER_WELCOME_ENABLED = "true";
    assert.equal(isFotorankPartnerWelcomeEnabled(), true);
    assert.equal(isFotorankHomeMarqueeEnabled(), false);
    assert.equal(isFotorankContestMarqueeEnabled(), false);

    process.env.FOTORANK_HOME_MARQUEE_ENABLED = "1";
    assert.equal(isFotorankHomeMarqueeEnabled(), true);
    assert.equal(isFotorankContestMarqueeEnabled(), false);

    process.env.FOTORANK_CONTEST_MARQUEE_ENABLED = "yes";
    assert.equal(isFotorankContestMarqueeEnabled(), true);

    process.env.FOTORANK_HOME_MARQUEE_ENABLED = "maybe";
    assert.equal(isFotorankHomeMarqueeEnabled(), false);

    process.env.FOTORANK_HOME_MARQUEE_ENABLED = "on";
    assert.equal(isFotorankHomeMarqueeEnabled(), true);

    delete process.env.FOTORANK_HOME_MARQUEE_ENABLED;
    delete process.env.FOTORANK_CONTEST_MARQUEE_ENABLED;
    delete process.env.FOTORANK_PARTNER_WELCOME_ENABLED;
  });
});

describe("fotorank marquee admin matrix", () => {
  it("home y contest montados como Disponible; FotoOffice ausente", () => {
    assert.ok(MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS.includes("FOTORANK_HOME_MARQUEE"));
    assert.ok(MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS.includes("FOTORANK_CONTEST_MARQUEE"));
    assert.ok(MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS.includes("CLICKATON_HOME_MARQUEE"));
    assert.ok(MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS.includes("CLICKATON_EVENT_MARQUEE"));
    assert.equal(UNMOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS.length, 0);

    const ui = listLogoMarqueePlacementsForAdminUi();
    const home = ui.find((p) => p.placementKey === "FOTORANK_HOME_MARQUEE")!;
    const contest = ui.find((p) => p.placementKey === "FOTORANK_CONTEST_MARQUEE")!;
    assert.equal(home.mounted, true);
    assert.equal(home.availabilityLabel, "Disponible");
    assert.equal(contest.mounted, true);
    assert.equal(contest.availabilityLabel, "Disponible");
    assert.ok(ui.every((p) => (p.application as string) !== "FOTO_OFFICE"));
  });
});

describe("fotorank marquee selection rules", () => {
  const contestId = "fr_contest_canonical_1";

  it("home/sin contestId: solo GLOBAL/PLATFORM; null no es global", () => {
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: "__none__",
        participation: null,
      }),
      false,
    );
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: "__none__",
        participation: {
          application: "FOTO_RANK",
          contextType: "GLOBAL",
          contextId: null,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      true,
    );
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: "__none__",
        participation: {
          application: "FOTO_RANK",
          contextType: "PLATFORM",
          contextId: null,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      true,
    );
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: "__none__",
        participation: {
          application: "FOTO_RANK",
          contextType: "CONTEST",
          contextId: contestId,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      false,
    );
  });

  it("concurso: acepta mismo FotorankContest.id + GLOBAL/PLATFORM; rechaza otro id y null", () => {
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId,
        participation: {
          application: "FOTO_RANK",
          contextType: "CONTEST",
          contextId: contestId,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      true,
    );
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId,
        participation: {
          application: "FOTO_RANK",
          contextType: "CONTEST",
          contextId: "otro_concurso",
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      false,
    );
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId,
        participation: null,
      }),
      false,
    );
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId,
        participation: {
          application: "FOTO_RANK",
          contextType: "GLOBAL",
          contextId: null,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      true,
    );
  });
});
