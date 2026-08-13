import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  isClickatonEventMarqueeEnabled,
  isClickatonHomeMarqueeEnabled,
  isClickatonPartnerWelcomeEnabled,
  listLogoMarqueePlacementsForAdminUi,
  MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS,
  UNMOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS,
} from "@repo/partners";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("clickaton marquee flags", () => {
  it("default OFF; welcome no activa marquees; home/event independientes", () => {
    delete process.env.CLICKATON_HOME_MARQUEE_ENABLED;
    delete process.env.CLICKATON_EVENT_MARQUEE_ENABLED;
    delete process.env.CLICKATON_PARTNER_WELCOME_ENABLED;
    assert.equal(isClickatonHomeMarqueeEnabled(), false);
    assert.equal(isClickatonEventMarqueeEnabled(), false);
    assert.equal(isClickatonPartnerWelcomeEnabled(), false);

    process.env.CLICKATON_PARTNER_WELCOME_ENABLED = "true";
    assert.equal(isClickatonPartnerWelcomeEnabled(), true);
    assert.equal(isClickatonHomeMarqueeEnabled(), false);
    assert.equal(isClickatonEventMarqueeEnabled(), false);

    process.env.CLICKATON_HOME_MARQUEE_ENABLED = "1";
    assert.equal(isClickatonHomeMarqueeEnabled(), true);
    assert.equal(isClickatonEventMarqueeEnabled(), false);

    process.env.CLICKATON_EVENT_MARQUEE_ENABLED = "yes";
    assert.equal(isClickatonEventMarqueeEnabled(), true);

    process.env.CLICKATON_HOME_MARQUEE_ENABLED = "maybe";
    assert.equal(isClickatonHomeMarqueeEnabled(), false);

    delete process.env.CLICKATON_HOME_MARQUEE_ENABLED;
    delete process.env.CLICKATON_EVENT_MARQUEE_ENABLED;
    delete process.env.CLICKATON_PARTNER_WELCOME_ENABLED;
  });
});

describe("clickaton marquee admin matrix", () => {
  it("CLICKATON home/event montados; FotoRank aún no", () => {
    assert.ok(MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS.includes("CLICKATON_HOME_MARQUEE"));
    assert.ok(MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS.includes("CLICKATON_EVENT_MARQUEE"));
    assert.ok(UNMOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS.includes("FOTORANK_HOME_MARQUEE"));
    const ui = listLogoMarqueePlacementsForAdminUi();
    const home = ui.find((p) => p.placementKey === "CLICKATON_HOME_MARQUEE")!;
    const event = ui.find((p) => p.placementKey === "CLICKATON_EVENT_MARQUEE")!;
    assert.equal(home.mounted, true);
    assert.equal(home.selectable, true);
    assert.equal(home.availabilityLabel, "Disponible");
    assert.equal(event.mounted, true);
    assert.equal(event.selectable, true);
  });
});

describe("clickaton marquee surfaces", () => {
  it("home y evento montan PartnerLogoMarquee solo con items; legacy intacto", () => {
    const home = read("app/(public)/page.tsx");
    assert.match(home, /loadClickatonHomeMarqueeAds/);
    assert.match(home, /ClickatonPartnerLogoMarquee/);
    assert.match(home, /CLICKATON_HOME_MARQUEE_TITLE/);
    assert.doesNotMatch(home, /AlliesLogoMarquee/);

    const shared = read("lib/public/partners-marquee-shared.ts");
    assert.match(shared, /Marcas que nos acompañan/);
    assert.match(shared, /Sponsors del evento/);

    const eventPage = read("app/(public)/maratones/[slug]/page.tsx");
    assert.match(eventPage, /loadClickatonEventMarqueeAds/);
    assert.match(eventPage, /partnerMarqueeItems/);

    const detail = read("components/marathon/MarathonDetailView.tsx");
    assert.match(detail, /MarathonSponsors/);
    assert.match(detail, /ClickatonPartnerLogoMarquee/);
    assert.match(detail, /CLICKATON_EVENT_MARQUEE_TITLE/);

    const allies = read("components/formar-parte/AlliesLogoMarquee.tsx");
    assert.match(allies, /AlliesLogoMarquee/);
    assert.doesNotMatch(allies, /PartnerLogoMarquee/);
    assert.doesNotMatch(allies, /CLICKATON_.*_MARQUEE/);

    const sponsors = read("components/marathon/MarathonSponsors.tsx");
    assert.match(sponsors, /Alianzas de la edición/);
    assert.doesNotMatch(sponsors, /PartnerLogoMarquee/);
  });

  it("loaders cortan con flag OFF antes de consultar DB", () => {
    const homeLoader = read("lib/public/partners-home-marquee.ts");
    assert.match(homeLoader, /isClickatonHomeMarqueeEnabled/);
    assert.match(homeLoader, /if \(!isClickatonHomeMarqueeEnabled\(\)\) return \[\]/);
    assert.match(homeLoader, /CLICKATON_HOME_MARQUEE/);

    const eventLoader = read("lib/public/partners-event-marquee.ts");
    assert.match(eventLoader, /isClickatonEventMarqueeEnabled/);
    assert.match(eventLoader, /if \(!isClickatonEventMarqueeEnabled\(\)\) return \[\]/);
    assert.match(eventLoader, /editionContextId: input\.editionId/);
    assert.match(eventLoader, /\/maratones\//);
  });
});
