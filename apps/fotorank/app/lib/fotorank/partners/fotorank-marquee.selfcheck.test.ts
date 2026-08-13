import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function read(rel: string): string {
  return readFileSync(join(here, rel), "utf8");
}

describe("fotorank marquee surfaces", () => {
  it("home y concurso montan PartnerLogoMarquee solo con items; legacy sponsors intacto", () => {
    const home = read("../../../page.tsx");
    assert.match(home, /loadFotorankHomeMarqueeAds/);
    assert.match(home, /FotorankPartnerLogoMarquee/);
    assert.match(home, /FOTORANK_HOME_MARQUEE_TITLE/);
    assert.match(home, /homeMarqueeItems\.length > 0/);

    const homeView = read("../../../components/public-home/HomeView.tsx");
    assert.match(homeView, /brandMarquee/);
    assert.doesNotMatch(homeView, /FOTORANK_PARTNER_WELCOME/);

    const contestPage = read("../../../concursos/[slug]/page.tsx");
    assert.match(contestPage, /loadFotorankContestMarqueeAds/);
    assert.match(contestPage, /contestId: data\.contest\.id/);
    assert.match(contestPage, /FotorankPartnerLogoMarquee/);
    assert.match(contestPage, /FOTORANK_CONTEST_MARQUEE_TITLE/);
    assert.match(contestPage, /ContestPublicLanding/);
    assert.match(contestPage, /FotorankContestPartnerWelcome/);
    assert.match(contestPage, /santa-fe-en-foco/);

    const landing = read("../../../concursos/[slug]/ContestPublicLanding.tsx");
    assert.match(landing, /brandMarquee/);
    assert.match(landing, /sponsorsText/);
    assert.match(landing, /Sponsors y apoyos/);
    assert.match(landing, /public-ui/);
    assert.match(landing, /santa-fe-en-foco/);
    assert.doesNotMatch(landing, /"use client"/);

    const wrapper = read("../../../components/partners/FotorankPartnerLogoMarquee.tsx");
    assert.match(wrapper, /PartnerLogoMarquee/);
    assert.match(wrapper, /if \(items\.length === 0\) return null/);
    assert.doesNotMatch(wrapper, /WelcomeInterstitial|welcomeMedia|WELCOME_GRAPHIC/);

    const shared = read("./marquee-shared.ts");
    assert.match(shared, /Marcas que nos acompañan/);
    assert.match(shared, /Sponsors del concurso/);
  });

  it("loaders cortan con flag OFF antes de consultar DB; placements conectados", () => {
    const homeLoader = read("./home-marquee.ts");
    assert.match(homeLoader, /isFotorankHomeMarqueeEnabled/);
    assert.match(homeLoader, /if \(!isFotorankHomeMarqueeEnabled\(\)\) return \[\]/);
    assert.match(homeLoader, /FOTORANK_HOME_MARQUEE/);
    assert.match(homeLoader, /placementKey: FOTORANK_HOME_MARQUEE_PLACEMENT/);
    const homeCall = homeLoader.match(
      /loadPartnerAdsForPlacement\(prisma, \{([\s\S]*?)\}\)/,
    )?.[1];
    assert.ok(homeCall);
    assert.doesNotMatch(homeCall!, /contestContextId/);

    const contestLoader = read("./contest-marquee.ts");
    assert.match(contestLoader, /isFotorankContestMarqueeEnabled/);
    assert.match(contestLoader, /if \(!isFotorankContestMarqueeEnabled\(\)\) return \[\]/);
    assert.match(contestLoader, /contestContextId: input\.contestId/);
    assert.match(contestLoader, /\/concursos\//);
    assert.match(contestLoader, /FOTORANK_CONTEST_MARQUEE/);

    const welcome = read("./contest-welcome.ts");
    assert.match(welcome, /isFotorankPartnerWelcomeEnabled/);
    assert.doesNotMatch(welcome, /isFotorankHomeMarqueeEnabled|isFotorankContestMarqueeEnabled/);
  });

  it("Santa Fe en Foco conserva wiring public-ui y no monta marquee en inscripción", () => {
    const contestPage = read("../../../concursos/[slug]/page.tsx");
    assert.match(contestPage, /getPublicContestLandingBySlug/);
    assert.match(contestPage, /ContestPublicLanding/);
    assert.match(contestPage, /santa-fe-en-foco/);

    const landing = read("../../../concursos/[slug]/ContestPublicLanding.tsx");
    assert.match(landing, /isSfef/);
    assert.match(landing, /contest-assets\/santa-fe-en-foco/);
    assert.match(landing, /inscripcionHref/);
    assert.match(landing, /PrimaryButton/);

    const inscripcion = read("../../../concursos/[slug]/inscripcion/page.tsx");
    assert.doesNotMatch(
      inscripcion,
      /FotorankPartnerLogoMarquee|loadFotorankContestMarqueeAds|FOTORANK_.*_MARQUEE/,
    );
  });
});
