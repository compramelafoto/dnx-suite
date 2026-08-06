import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "../../..");

describe("home pública migrada", () => {
  it("HomeView usa PublicShell y CTAs a concursos", () => {
    const home = readFileSync(join(APP, "components/public-home/HomeView.tsx"), "utf8");
    assert.match(home, /PublicShell/);
    assert.match(home, /PublicSectionHeader/);
    assert.match(home, /Ver concursos/);
    assert.match(home, /id="concursos"/);
    assert.doesNotMatch(home, /LandingHeader|HeroSection|ProblemSection|FullscreenMenu/);
    assert.doesNotMatch(home, /#d4af37|text-gold|fr-btn\b|fr-recuadro\b/);
  });

  it("tokens públicos evitan dorado legacy y amarillo Clickatón", () => {
    const tokens = readFileSync(join(APP, "styles/public-tokens.css"), "utf8");
    assert.match(tokens, /--primary:\s*#c4a35a/);
    assert.doesNotMatch(tokens, /#d4af37|#FFC400|#ffc400/);
    assert.doesNotMatch(tokens, /--ck-/);
  });
});

describe("PublicHeader unificado", () => {
  it("expone menú móvil accesible y cierra con Escape", () => {
    const header = readFileSync(join(APP, "components/public-ui/PublicHeader.tsx"), "utf8");
    assert.match(header, /aria-expanded/);
    assert.match(header, /aria-controls/);
    assert.match(header, /Abrir menú/);
    assert.match(header, /Cerrar menú/);
    assert.match(header, /role="dialog"/);
    assert.match(header, /aria-modal/);
    assert.match(header, /Escape/);
    assert.match(header, /variant === "marketing"/);
    assert.match(header, /\/participaciones/);
    assert.doesNotMatch(header, /LandingHeader|FullscreenMenu|app-header/);
    assert.doesNotMatch(header, /\/maraton|\/ediciones|clickaton/i);
  });
});

describe("fixtures de estados públicos", () => {
  it("preview noindex existe para capturas seguras", () => {
    const preview = join(APP, "dev/public-ds-preview/page.tsx");
    assert.ok(existsSync(preview));
    const src = readFileSync(preview, "utf8");
    assert.match(src, /upload-closed|participant-dashboard|landing/);
    assert.match(src, /robots:\s*\{\s*index:\s*false/);
  });
});
