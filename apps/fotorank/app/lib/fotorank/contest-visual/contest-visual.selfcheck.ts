import assert from "node:assert/strict";
import {
  applyRuntimeMedia,
  contestThemeToCssVars,
  emptyContestVisualPresentation,
  focalToObjectPosition,
  hasUsableImageUrl,
  normalizeFocalPoint,
  resolveContestVisualTheme,
  resolveHeroAsset,
  SANTA_FE_EN_FOCO_VISUAL_THEME,
  usableGallery,
} from "./index";

const santa = resolveContestVisualTheme("santa-fe-en-foco");
assert.equal(santa.id, SANTA_FE_EN_FOCO_VISUAL_THEME.id);
assert.equal(santa.heroDesktopUrl, "");
assert.equal(santa.sectionSpacingPreset, "compact");
assert.equal(hasUsableImageUrl(santa.heroDesktopUrl), false);
assert.equal(hasUsableImageUrl("https://cdn.example/hero.jpg"), true);
assert.ok(santa.presentation);
assert.equal(santa.presentation.hero.desktop, null);
assert.equal(santa.presentation.gallery.length, 0);

const vars = contestThemeToCssVars(santa);
assert.ok(vars["--cv-background"]);
assert.ok(vars["--cv-primary"]);
assert.equal(vars["--cv-section-pad"], "2.25rem");
assert.ok(vars["--cv-hero-min-height"]);
assert.ok(vars["--cv-on-hero-fg"]);

const other = resolveContestVisualTheme("otro-concurso");
assert.equal(other.id, "fotorank-default");
assert.equal(other.sectionSpacingPreset, "comfortable");

/* Focal */
assert.deepEqual(normalizeFocalPoint(-10, 120), { x: 0, y: 100 });
assert.deepEqual(normalizeFocalPoint(undefined, null), { x: 50, y: 50 });
assert.equal(focalToObjectPosition(20, 80), "20% 80%");

/* Runtime cover → hero sin romper fallback tipográfico cuando no hay URL */
const withCover = resolveContestVisualTheme("santa-fe-en-foco", undefined, {
  coverImageUrl: "https://cdn.example/cover.jpg",
  organizerLogoUrl: "https://cdn.example/logo.png",
  contestTitle: "Santa Fe en Foco",
  organizerName: "SFPR",
});
assert.ok(withCover.presentation.hero.desktop);
assert.equal(withCover.presentation.hero.desktop?.url, "https://cdn.example/cover.jpg");
assert.ok(withCover.presentation.identity.organizerLogo);
const heroMobile = resolveHeroAsset(withCover.presentation, "mobile");
assert.equal(heroMobile?.url, "https://cdn.example/cover.jpg");

/* Invalid URLs ignored */
const bad = applyRuntimeMedia(emptyContestVisualPresentation(), {
  coverImageUrl: "#",
  organizerLogoUrl: "about:blank",
});
assert.equal(bad.hero.desktop, null);
assert.equal(bad.identity.organizerLogo, null);

/* Gallery empty / filter */
assert.equal(usableGallery([]).length, 0);
assert.equal(
  usableGallery([
    { url: "", alt: "x" },
    { url: "https://cdn.example/a.jpg", alt: "" },
    { url: "https://cdn.example/b.jpg", alt: "Ok" },
  ]).length,
  1,
);

/* Preset no inventa assets */
assert.equal(SANTA_FE_EN_FOCO_VISUAL_THEME.presentation.editorial.overview, null);
assert.equal(SANTA_FE_EN_FOCO_VISUAL_THEME.presentation.social, null);

console.log("contest-visual.selfcheck: OK");
