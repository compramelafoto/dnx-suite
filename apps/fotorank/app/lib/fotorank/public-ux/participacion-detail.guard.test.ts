import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "../../..");

describe("participacion detail route", () => {
  it("exposes /participaciones/[id] with auth + ownership + public-ui dashboard", () => {
    const abs = join(APP, "(participant)/participaciones/[id]/page.tsx");
    assert.ok(existsSync(abs), "missing participaciones/[id]/page.tsx");
    const src = readFileSync(abs, "utf8");
    assert.match(src, /getMyParticipationView/);
    assert.match(src, /requireAuth/);
    assert.match(src, /ParticipantDashboard/);
    assert.match(src, /resolvePublicEntryStatus/);
    assert.match(src, /notFound\(\)/);
    assert.doesNotMatch(src, /#FFC400|#ffc400|apps\/clickaton/);
  });

  it("inscription success CTA points to the detail route that now exists", () => {
    const src = readFileSync(join(APP, "concursos/[slug]/inscripcion/page.tsx"), "utf8");
    assert.match(src, /Ver detalle de participación/);
    assert.match(src, /\/participaciones\/\$\{existing\.id\}/);
  });
});
