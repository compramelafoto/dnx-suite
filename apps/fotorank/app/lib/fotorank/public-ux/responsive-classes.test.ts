import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

describe("public tokens responsive contract", () => {
  it("defines mobile-first gutters and sticky mobile action bar", () => {
    const css = readFileSync(
      join(HERE, "../../../styles/public-tokens.css"),
      "utf8",
    );
    assert.match(css, /--public-gutter:\s*clamp\(1rem/);
    assert.match(css, /--public-stack-title-to-subtitle:\s*var\(--public-space-5\)/);
    assert.match(css, /--public-stack-subtitle-to-content:\s*var\(--public-space-10\)/);
    assert.match(css, /--public-stack-content-to-actions:\s*var\(--public-space-12\)/);
    assert.match(css, /\.fr-public-stack-content/);
    assert.match(css, /\.fr-public-cta-band/);
    assert.match(css, /\.fr-public-mobile-bar/);
    assert.match(css, /@media \(min-width: 768px\)/);
    assert.match(css, /--primary:\s*#c4a35a/);
    assert.match(css, /--background:/);
    assert.match(css, /--container-width:/);
    assert.doesNotMatch(css, /#FFC400|#ffc400|--ck-/);
  });
});
