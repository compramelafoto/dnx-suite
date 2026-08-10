import assert from "node:assert/strict";
import {
  applyRuntimeMedia,
  contestThemeToCssVars,
  contrastRatio,
  emptyContestVisualPresentation,
  focalToObjectPosition,
  hasUsableImageUrl,
  isValidHexColor,
  normalizeFocalPoint,
  parsePublicPageVisualJson,
  publicPageVisualToThemePartial,
  resolveContestVisualTheme,
  resolveHeroAsset,
  SANTA_FE_EN_FOCO_VISUAL_THEME,
  usableGallery,
  validatePublicPageVisualInput,
} from "./index";

const santa = resolveContestVisualTheme("santa-fe-en-foco");
assert.equal(santa.id, SANTA_FE_EN_FOCO_VISUAL_THEME.id);
assert.equal(santa.backgroundColor, "#f7f4ef");
assert.equal(santa.primaryColor, "#0b3a6e");
assert.equal(santa.presentation.hero.layout, "stacked");
assert.equal(santa.presentation.hero.overlayStrength, "none");
assert.ok(santa.presentation.hero.desktop);
assert.ok(
  santa.presentation.hero.desktop?.url.includes(
    "/contest-assets/santa-fe-en-foco/hero/hero-desktop.jpg",
  ),
);
assert.equal(hasUsableImageUrl("https://cdn.example/hero.jpg"), true);

const vars = contestThemeToCssVars(santa);
assert.equal(vars["--cv-background"], "#f7f4ef");
assert.equal(vars["--cv-primary"], "#0b3a6e");
assert.ok(vars["--cv-accent"]);

const other = resolveContestVisualTheme("otro-concurso");
assert.equal(other.id, "fotorank-default");
assert.equal(other.backgroundColor, "#050505");
assert.notEqual(other.primaryColor, santa.primaryColor);
assert.equal(other.presentation.hero.desktop, null);

/* Slug similar no hereda el tema SFEF */
const similar = resolveContestVisualTheme("santa-fe-en-una-foto");
assert.equal(similar.id, "fotorank-default");
assert.notEqual(similar.backgroundColor, santa.backgroundColor);

/* Focal */
assert.deepEqual(normalizeFocalPoint(-10, 120), { x: 0, y: 100 });
assert.deepEqual(normalizeFocalPoint(undefined, null), { x: 50, y: 50 });
assert.equal(focalToObjectPosition(20, 80), "20% 80%");

/* Runtime cover no pisa hero del preset SFEF */
const withCover = resolveContestVisualTheme("santa-fe-en-foco", undefined, {
  coverImageUrl: "https://cdn.example/cover.jpg",
  organizerLogoUrl: "https://cdn.example/logo.png",
  contestTitle: "Santa Fe en Foco",
  organizerName: "SFPR",
});
assert.equal(
  withCover.presentation.hero.desktop?.url,
  santa.presentation.hero.desktop?.url,
);
assert.ok(withCover.presentation.identity.organizerLogo);

/* Otro concurso usa cover como hero */
const otherCover = resolveContestVisualTheme("otro-concurso", undefined, {
  coverImageUrl: "https://cdn.example/cover.jpg",
  contestTitle: "Otro",
});
assert.equal(otherCover.presentation.hero.desktop?.url, "https://cdn.example/cover.jpg");

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

/* Public page visual config */
assert.equal(parsePublicPageVisualJson(null), null);
assert.equal(isValidHexColor("#0b3a6e"), true);
assert.equal(isValidHexColor("#fff"), false);
assert.ok(contrastRatio("#f7f4ef", "#12141a") >= 4.5);

const invalidColor = validatePublicPageVisualInput({ v: 1, primaryColor: "red" });
assert.equal(invalidColor.ok, false);

const badContrast = validatePublicPageVisualInput({
  v: 1,
  backgroundColor: "#ffffff",
  foregroundColor: "#eeeeee",
});
assert.equal(badContrast.ok, false);

const okConfig = validatePublicPageVisualInput({
  v: 1,
  primaryColor: "#0B3A6E",
  backgroundColor: "#F7F4EF",
  foregroundColor: "#12141A",
  accentColor: "#E85A2D",
  bannerUrl: "https://cdn.example/banner.jpg",
  heroLayout: "stacked",
  heroOverlayStrength: "none",
});
assert.equal(okConfig.ok, true);
if (okConfig.ok) {
  const partial = publicPageVisualToThemePartial(okConfig.value);
  assert.ok(partial);
  assert.equal(partial?.primaryColor, "#0b3a6e");
  assert.equal(partial?.presentation?.hero?.desktop?.url, "https://cdn.example/banner.jpg");
}

const themedOther = resolveContestVisualTheme(
  "otro-concurso",
  publicPageVisualToThemePartial({
    v: 1,
    primaryColor: "#112233",
    backgroundColor: "#fafafa",
    foregroundColor: "#111111",
  }),
);
assert.equal(themedOther.primaryColor, "#112233");
assert.equal(themedOther.backgroundColor, "#fafafa");
assert.notEqual(resolveContestVisualTheme("tercero").primaryColor, "#112233");

const heroMobile = resolveHeroAsset(withCover.presentation, "mobile");
assert.ok(heroMobile?.url.includes("hero-mobile.jpg") || heroMobile?.url.includes("hero-desktop.jpg"));

console.log("contest-visual.selfcheck: OK");
