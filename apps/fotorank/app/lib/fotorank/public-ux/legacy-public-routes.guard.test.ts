import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "../../..");

/**
 * Rutas públicas / participante migradas a public-ui.
 * Inscripción (`inscripcion/*`) conserva UI ETAPA 10C (`contest-public` + upload wizard)
 * a propósito: la lógica productiva de Santa Fe prevalece sobre el restyle visual.
 */
const SCOPED_FILES = [
  "page.tsx",
  "components/public-home/HomeView.tsx",
  "components/public-ui/PublicHeader.tsx",
  "components/public-ui/PublicFooter.tsx",
  "components/public-ui/PublicShell.tsx",
  "concursos/[slug]/ContestPublicLanding.tsx",
  "concursos/[slug]/page.tsx",
  "(participant)/layout.tsx",
  "(participant)/participaciones/page.tsx",
  "(participant)/participaciones/[id]/page.tsx",
];

const FORBIDDEN = [
  /from\s+["'].*components\/landing\/LandingHeader/,
  /from\s+["'].*components\/landing\/HeroSection/,
  /from\s+["'].*components\/landing\/FullscreenMenu/,
  /from\s+["'].*components\/app-header/,
  /\bfr-btn\b/,
  /\bfr-recuadro\b/,
  /\bfr-section\b/,
  /\bfr-container\b/,
  /\bfr-eyebrow\b/,
  /\btext-gold\b/,
  /\bbg-fr-bg\b/,
  /\bbg-fr-card\b/,
  /#FFC400|#ffc400/,
  /apps\/clickaton/,
  /--ck-/,
];

describe("public routes legacy guard", () => {
  it("migrated public/participant files avoid legacy fr-* and Clickatón product deps", () => {
    for (const rel of SCOPED_FILES) {
      const abs = join(APP, rel);
      assert.ok(existsSync(abs), `missing scoped file ${rel}`);
      const src = readFileSync(abs, "utf8");
      for (const re of FORBIDDEN) {
        assert.equal(re.test(src), false, `${rel} matched ${re}`);
      }
    }
  });

  it("home page uses HomeView + PublicShell path (not LandingHeader)", () => {
    const page = readFileSync(join(APP, "page.tsx"), "utf8");
    assert.match(page, /HomeView/);
    assert.doesNotMatch(page, /LandingHeader/);
    assert.doesNotMatch(page, /HeroSection/);
  });
});
